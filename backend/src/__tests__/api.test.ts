/**
 * Integration tests for the HTTP API.
 *
 * Uses supertest to make real HTTP requests against the Express app,
 * against an in-memory SQLite DB (set in setup.ts).
 *
 * Tests cover the happy path and key error cases for each endpoint.
 */

import request from 'supertest';
import express from 'express';
import db from '../models/db';
import { ROCK_TYPES } from '../data/rockTypes';
import apiRouter from '../routes/index';

// Build a minimal Express app — no scheduler, no server.listen().
const app = express();
app.use(express.json());
app.use('/api', apiRouter);

// ── Helpers ───────────────────────────────────────────────────────────────────

function seedTypes() {
  const n = (db.prepare('SELECT COUNT(*) AS n FROM rock_types').get() as { n: number }).n;
  if (n > 0) return;
  const insert = db.prepare(`
    INSERT INTO rock_types (
      name, category, rarity_score, spawn_weight,
      color_primary, color_secondary,
      size_range_min_mm, size_range_max_mm,
      hardness_min, hardness_max,
      luster, texture, description, fun_fact
    ) VALUES (@name, @category, @rarityScore, @spawnWeight, @colorPrimary, @colorSecondary,
              @sizeRangeMinMm, @sizeRangeMaxMm, @hardnessMin, @hardnessMax,
              @luster, @texture, @description, @funFact)
  `);
  db.transaction(() => { for (const rt of ROCK_TYPES) insert.run(rt); })();
}

function insertRoadRock(overrides: Partial<{
  id: string; typeId: number; canvasX: number; canvasY: number;
  sizeMm: number; isCollected: number;
}> = {}) {
  const typeId = overrides.typeId ?? 1;
  const row = {
    id: overrides.id ?? '00000000-0000-4000-8000-000000000001',
    typeId,
    canvasX: overrides.canvasX ?? 0.5,
    canvasY: overrides.canvasY ?? 0.5,
    sizeMm: overrides.sizeMm ?? 20,
    isCollected: overrides.isCollected ?? 0,
    resetAt: new Date().toISOString(),
  };
  db.prepare(`
    INSERT OR REPLACE INTO road_rocks (id, type_id, canvas_x, canvas_y, size_mm, is_collected, reset_at)
    VALUES (@id, @typeId, @canvasX, @canvasY, @sizeMm, @isCollected, @resetAt)
  `).run(row);
  return row;
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeAll(() => seedTypes());

beforeEach(() => {
  db.prepare('DELETE FROM journal_entries').run();
  db.prepare('DELETE FROM shelf_rocks').run();
  db.prepare('DELETE FROM road_rocks').run();
});

// ── GET /api/rocks ─────────────────────────────────────────────────────────────

describe('GET /api/rocks', () => {
  test('returns empty array when no rocks', async () => {
    const res = await request(app).get('/api/rocks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns uncollected rocks with rock type data', async () => {
    insertRoadRock({ isCollected: 0 });
    const res = await request(app).get('/api/rocks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const rock = res.body[0];
    expect(rock).toHaveProperty('id');
    expect(rock).toHaveProperty('rockType');
    expect(rock.rockType).toHaveProperty('name');
    expect(rock.isCollected).toBe(false);
  });

  test('does not return already-collected rocks', async () => {
    insertRoadRock({ id: 'aaaaaaaa-0000-4000-8000-000000000001', isCollected: 0 });
    insertRoadRock({ id: 'bbbbbbbb-0000-4000-8000-000000000002', isCollected: 1 });
    const res = await request(app).get('/api/rocks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

// ── POST /api/rocks/:id/collect ────────────────────────────────────────────────

describe('POST /api/rocks/:id/collect', () => {
  test('marks a rock as collected', async () => {
    const { id } = insertRoadRock();
    const res = await request(app).post(`/api/rocks/${id}/collect`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const row = db.prepare('SELECT is_collected FROM road_rocks WHERE id = ?').get(id) as { is_collected: number };
    expect(row.is_collected).toBe(1);
  });

  test('returns 404 for unknown ID', async () => {
    const res = await request(app).post('/api/rocks/nonexistent-id/collect');
    expect(res.status).toBe(404);
  });

  test('returns 409 if rock already collected', async () => {
    const { id } = insertRoadRock({ isCollected: 1 });
    const res = await request(app).post(`/api/rocks/${id}/collect`);
    expect(res.status).toBe(409);
  });
});

// ── GET /api/shelf ─────────────────────────────────────────────────────────────

describe('GET /api/shelf', () => {
  test('returns empty array when shelf is empty', async () => {
    const res = await request(app).get('/api/shelf');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ── POST /api/shelf ────────────────────────────────────────────────────────────

describe('POST /api/shelf', () => {
  test('adds a collected rock to the shelf', async () => {
    const rr = insertRoadRock({ isCollected: 1, sizeMm: 15 });
    const res = await request(app)
      .post('/api/shelf')
      .send({ roadRockId: rr.id, rockTypeId: rr.typeId, sizeMm: rr.sizeMm });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.nickname).toBeNull();
    expect(res.body.rockType.name).toBeTruthy();
  });

  test('saves a valid nickname', async () => {
    const rr = insertRoadRock({ isCollected: 1, sizeMm: 15 });
    const res = await request(app)
      .post('/api/shelf')
      .send({ roadRockId: rr.id, rockTypeId: rr.typeId, sizeMm: rr.sizeMm, nickname: 'Rocky' });

    expect(res.status).toBe(201);
    expect(res.body.nickname).toBe('Rocky');
  });

  test('rejects a profane nickname with 400', async () => {
    const rr = insertRoadRock({ isCollected: 1, sizeMm: 15 });
    const res = await request(app)
      .post('/api/shelf')
      .send({ roadRockId: rr.id, rockTypeId: rr.typeId, sizeMm: rr.sizeMm, nickname: 'ass' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  test('rejects if road rock was not collected first', async () => {
    const rr = insertRoadRock({ isCollected: 0 });
    const res = await request(app)
      .post('/api/shelf')
      .send({ roadRockId: rr.id, rockTypeId: rr.typeId, sizeMm: rr.sizeMm });

    expect(res.status).toBe(400);
  });

  test('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/shelf').send({});
    expect(res.status).toBe(400);
  });

  test('auto-creates a journal entry alongside the shelf rock', async () => {
    const rr = insertRoadRock({ isCollected: 1, sizeMm: 15 });
    await request(app)
      .post('/api/shelf')
      .send({ roadRockId: rr.id, rockTypeId: rr.typeId, sizeMm: rr.sizeMm, nickname: 'Gem' });

    const entry = db
      .prepare('SELECT * FROM journal_entries')
      .get() as { auto_text: string };
    expect(entry).toBeTruthy();
    expect(entry.auto_text.length).toBeGreaterThan(0);
  });
});

// ── DELETE /api/shelf/:id ─────────────────────────────────────────────────────

describe('DELETE /api/shelf/:id', () => {
  test('removes a shelf rock', async () => {
    const rr = insertRoadRock({ isCollected: 1 });
    const addRes = await request(app)
      .post('/api/shelf')
      .send({ roadRockId: rr.id, rockTypeId: rr.typeId, sizeMm: rr.sizeMm });
    const shelfId = addRes.body.id as string;

    const delRes = await request(app).delete(`/api/shelf/${shelfId}`);
    expect(delRes.status).toBe(200);

    const count = (db.prepare('SELECT COUNT(*) AS n FROM shelf_rocks').get() as { n: number }).n;
    expect(count).toBe(0);
  });

  test('returns 404 for nonexistent shelf rock', async () => {
    const res = await request(app).delete('/api/shelf/does-not-exist');
    expect(res.status).toBe(404);
  });
});

// ── GET /api/journal ────────────────────────────────────────────────────────────

describe('GET /api/journal', () => {
  test('returns journal entries with shelf rock data', async () => {
    const rr = insertRoadRock({ isCollected: 1, sizeMm: 15 });
    await request(app)
      .post('/api/shelf')
      .send({ roadRockId: rr.id, rockTypeId: rr.typeId, sizeMm: rr.sizeMm, nickname: 'Pebby' });

    const res = await request(app).get('/api/journal');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const entry = res.body[0];
    expect(entry).toHaveProperty('autoText');
    expect(entry.shelfRock).toHaveProperty('nickname', 'Pebby');
  });
});
