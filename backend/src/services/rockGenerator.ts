/**
 * Rock generation service.
 *
 * Responsible for populating the road_rocks table with a fresh batch of rocks.
 * Called at startup (if no rocks exist) and by the daily cron scheduler.
 *
 * Algorithm:
 *   1. Delete all existing road_rocks.
 *   2. For each rock slot (up to ROAD_ROCK_COUNT), pick a rock type via
 *      weighted-random selection (spawnWeight drives probability).
 *   3. Assign a random normalized position (canvas_x, canvas_y) within
 *      the "road" zone and a random size_mm within the type's allowed range.
 *   4. Bulk-insert into road_rocks.
 *
 * Weighted random ensures that Quartz (weight 250) appears roughly
 * 12,500× more often than Diamond (weight 0.02) — matching real geology.
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../models/db';

/** Rows as they come back from the rock_types table. */
interface RockTypeRow {
  id: number;
  spawn_weight: number;
  size_range_min_mm: number;
  size_range_max_mm: number;
}

/**
 * Picks one rock type at random, weighted by spawn_weight.
 * Higher weight = higher probability of selection.
 */
function weightedRandomType(types: RockTypeRow[]): RockTypeRow {
  const totalWeight = types.reduce((sum, t) => sum + t.spawn_weight, 0);
  let roll = Math.random() * totalWeight;
  for (const type of types) {
    roll -= type.spawn_weight;
    if (roll <= 0) return type;
  }
  // Fallback (floating point rounding edge case): return the last type.
  return types[types.length - 1];
}

/**
 * Returns a random float in [min, max].
 */
function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Generates and inserts a fresh batch of road rocks.
 *
 * @param count - How many rocks to generate (defaults to ROAD_ROCK_COUNT env var or 150).
 */
export function generateRoadRocks(count?: number): void {
  const rockCount = count ?? parseInt(process.env.ROAD_ROCK_COUNT ?? '150', 10);
  const resetAt = new Date().toISOString();

  // Load all rock types (needed for weighted selection).
  const types = db
    .prepare('SELECT id, spawn_weight, size_range_min_mm, size_range_max_mm FROM rock_types')
    .all() as RockTypeRow[];

  if (types.length === 0) {
    console.error('[rockGenerator] No rock types found in DB — did you run the seed?');
    return;
  }

  // Wrap insertions in a transaction for atomicity + performance.
  const insertRock = db.prepare(`
    INSERT INTO road_rocks (id, type_id, canvas_x, canvas_y, size_mm, reset_at)
    VALUES (@id, @typeId, @canvasX, @canvasY, @sizeMm, @resetAt)
  `);

  const clearRocks = db.prepare('DELETE FROM road_rocks');

  const runBatch = db.transaction(() => {
    // Wipe the old road first.
    clearRocks.run();

    // Update the last-reset timestamp in metadata.
    db.prepare(`
      INSERT INTO metadata (key, value) VALUES ('last_reset', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(resetAt);

    // Insert new rocks.
    for (let i = 0; i < rockCount; i++) {
      const type = weightedRandomType(types);

      // canvas_x: spread across the full road width (normalized 0–1).
      const canvasX = randomBetween(0.02, 0.98);

      // canvas_y: rocks live in the "road" portion of the canvas.
      // 0 = top of canvas, 1 = bottom. Road occupies roughly 0.3–0.95.
      // Slightly cluster toward the center for a natural look.
      const canvasY = randomBetween(0.30, 0.95);

      const sizeMm = randomBetween(type.size_range_min_mm, type.size_range_max_mm);

      insertRock.run({
        id: uuidv4(),
        typeId: type.id,
        canvasX,
        canvasY,
        sizeMm,
        resetAt,
      });
    }

    console.log(`[rockGenerator] Generated ${rockCount} road rocks at ${resetAt}`);
  });

  runBatch();
}

/**
 * Returns true if the road rocks need to be regenerated.
 * Checks the metadata table for the last reset time.
 */
export function needsReset(): boolean {
  const row = db
    .prepare("SELECT value FROM metadata WHERE key = 'last_reset'")
    .get() as { value: string } | undefined;

  if (!row) return true;

  const lastReset = new Date(row.value);
  const now = new Date();
  const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

  return hoursSinceReset >= 24;
}
