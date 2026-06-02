/**
 * Tests for the rock generator.
 *
 * We extract and test the core pure functions:
 *   - Weighted random selection (the distribution engine)
 *   - That generateRoadRocks() produces the right count and valid positions
 *
 * The DB is pointed at :memory: (see setup.ts) so tests are self-contained.
 */

// Note: DB_PATH is set to ':memory:' in setup.ts before this import runs.
import db from '../models/db';
import { ROCK_TYPES } from '../data/rockTypes';
import { generateRoadRocks, needsReset } from '../services/rockGenerator';

// ── Test helper: seed rock types into the in-memory DB ────────────────────────
function seedTypes() {
  const existing = (db.prepare('SELECT COUNT(*) AS n FROM rock_types').get() as { n: number }).n;
  if (existing > 0) return;

  const insert = db.prepare(`
    INSERT INTO rock_types (
      name, category, rarity_score, spawn_weight,
      color_primary, color_secondary,
      size_range_min_mm, size_range_max_mm,
      hardness_min, hardness_max,
      luster, texture, description, fun_fact
    ) VALUES (
      @name, @category, @rarityScore, @spawnWeight,
      @colorPrimary, @colorSecondary,
      @sizeRangeMinMm, @sizeRangeMaxMm,
      @hardnessMin, @hardnessMax,
      @luster, @texture, @description, @funFact
    )
  `);
  const insertAll = db.transaction(() => {
    for (const rt of ROCK_TYPES) insert.run(rt);
  });
  insertAll();
}

// ── Weighted random — extracted logic ─────────────────────────────────────────
// Duplicate the weightedRandom function here so we can unit-test it directly
// without it being private inside rockGenerator.ts.

interface TypeStub { id: number; spawn_weight: number; size_range_min_mm: number; size_range_max_mm: number; }

function weightedRandom(types: TypeStub[]): TypeStub {
  const total = types.reduce((s, t) => s + t.spawn_weight, 0);
  let roll = Math.random() * total;
  for (const t of types) {
    roll -= t.spawn_weight;
    if (roll <= 0) return t;
  }
  return types[types.length - 1];
}

describe('weightedRandom distribution', () => {
  const types: TypeStub[] = [
    { id: 1, spawn_weight: 900, size_range_min_mm: 5, size_range_max_mm: 80 },
    { id: 2, spawn_weight: 90,  size_range_min_mm: 5, size_range_max_mm: 30 },
    { id: 3, spawn_weight: 10,  size_range_min_mm: 2, size_range_max_mm: 10 },
  ];

  test('always returns a valid type', () => {
    for (let i = 0; i < 500; i++) {
      const picked = weightedRandom(types);
      expect(types.map(t => t.id)).toContain(picked.id);
    }
  });

  test('common type appears significantly more often than rare type', () => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    const N = 10_000;
    for (let i = 0; i < N; i++) {
      counts[weightedRandom(types).id]++;
    }
    // Type 1 has 90x the weight of type 3 — expect at least 40x the count.
    expect(counts[1]).toBeGreaterThan(counts[3] * 40);
    // Type 2 has 9x the weight of type 3 — expect at least 5x the count.
    expect(counts[2]).toBeGreaterThan(counts[3] * 5);
  });

  test('sum of all frequencies approximates 100%', () => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    const N = 1_000;
    for (let i = 0; i < N; i++) counts[weightedRandom(types).id]++;
    const total = Object.values(counts).reduce((s, c) => s + c, 0);
    expect(total).toBe(N);
  });
});

describe('generateRoadRocks', () => {
  beforeAll(() => seedTypes());

  beforeEach(() => {
    db.prepare('DELETE FROM road_rocks').run();
    db.prepare("DELETE FROM metadata WHERE key = 'last_reset'").run();
  });

  test('inserts the requested number of rocks', () => {
    generateRoadRocks(10);
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM road_rocks').get() as { n: number };
    expect(n).toBe(10);
  });

  test('generated rocks have valid normalized positions', () => {
    generateRoadRocks(5);
    const rocks = db.prepare('SELECT canvas_x, canvas_y FROM road_rocks').all() as {
      canvas_x: number;
      canvas_y: number;
    }[];
    for (const rock of rocks) {
      expect(rock.canvas_x).toBeGreaterThanOrEqual(0);
      expect(rock.canvas_x).toBeLessThanOrEqual(1);
      expect(rock.canvas_y).toBeGreaterThanOrEqual(0);
      expect(rock.canvas_y).toBeLessThanOrEqual(1);
    }
  });

  test('generated rocks have valid size_mm within type range', () => {
    generateRoadRocks(20);
    const rocks = db.prepare(`
      SELECT rr.size_mm, rt.size_range_min_mm, rt.size_range_max_mm
      FROM road_rocks rr JOIN rock_types rt ON rt.id = rr.type_id
    `).all() as { size_mm: number; size_range_min_mm: number; size_range_max_mm: number }[];

    for (const rock of rocks) {
      expect(rock.size_mm).toBeGreaterThanOrEqual(rock.size_range_min_mm - 0.01);
      expect(rock.size_mm).toBeLessThanOrEqual(rock.size_range_max_mm + 0.01);
    }
  });

  test('clears existing rocks before generating new ones', () => {
    generateRoadRocks(5);
    generateRoadRocks(8);
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM road_rocks').get() as { n: number };
    expect(n).toBe(8); // not 13
  });

  test('rocks have valid UUIDs as IDs', () => {
    generateRoadRocks(3);
    const rocks = db.prepare('SELECT id FROM road_rocks').all() as { id: string }[];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const rock of rocks) {
      expect(rock.id).toMatch(uuidRegex);
    }
  });
});

describe('needsReset', () => {
  beforeEach(() => {
    db.prepare("DELETE FROM metadata WHERE key = 'last_reset'").run();
  });

  test('returns true when no reset has ever happened', () => {
    expect(needsReset()).toBe(true);
  });

  test('returns false when reset happened within the last hour', () => {
    const recent = new Date().toISOString();
    db.prepare("INSERT INTO metadata (key, value) VALUES ('last_reset', ?)").run(recent);
    expect(needsReset()).toBe(false);
  });

  test('returns true when last reset was more than 24 hours ago', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    db.prepare("INSERT INTO metadata (key, value) VALUES ('last_reset', ?)").run(old);
    expect(needsReset()).toBe(true);
  });
});
