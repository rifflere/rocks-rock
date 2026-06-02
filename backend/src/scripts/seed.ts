/**
 * Seed script — run once to populate the rock_types table.
 * Safe to re-run: it checks if types already exist before inserting.
 *
 * Usage: npx ts-node src/scripts/seed.ts
 */

import db from '../models/db';
import { ROCK_TYPES } from '../data/rockTypes';

const existing = (db.prepare('SELECT COUNT(*) AS n FROM rock_types').get() as { n: number }).n;

if (existing > 0) {
  console.log(`[seed] rock_types already has ${existing} rows — skipping.`);
  process.exit(0);
}

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

const seedAll = db.transaction(() => {
  for (const rock of ROCK_TYPES) {
    insert.run(rock);
  }
});

seedAll();
console.log(`[seed] Inserted ${ROCK_TYPES.length} rock types.`);
