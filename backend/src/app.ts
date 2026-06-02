/**
 * Express application entry point.
 *
 * Startup sequence:
 *   1. Load environment variables.
 *   2. Open the SQLite database (via models/db.ts).
 *   3. Seed rock types if not already present.
 *   4. Start the daily reset scheduler (also runs immediately if stale).
 *   5. Mount the API router.
 *   6. Listen.
 */

import dotenv from 'dotenv';
dotenv.config(); // Must be before any other imports that read process.env.

import express from 'express';
import cors from 'cors';
import db from './models/db';
import { ROCK_TYPES } from './data/rockTypes';
import { startScheduler } from './services/scheduler';
import apiRouter from './routes/index';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ── Middleware ────────────────────────────────────────────────────────────────
// Allow requests from the Vite dev server (localhost:5173) and production origin.
app.use(cors({
  origin: [
    'http://localhost:5173',
    process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  ],
}));
app.use(express.json());

// ── Startup: seed rock types ──────────────────────────────────────────────────
const existingTypes = (db.prepare('SELECT COUNT(*) AS n FROM rock_types').get() as { n: number }).n;
if (existingTypes === 0) {
  console.log('[app] Seeding rock types...');
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
  console.log(`[app] Seeded ${ROCK_TYPES.length} rock types.`);
} else {
  console.log(`[app] Rock types already seeded (${existingTypes} types found).`);
}

// ── Startup: schedule rock resets ─────────────────────────────────────────────
startScheduler();

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// Health check — useful for Render deploy checks.
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[app] Rocks Rock API listening on http://localhost:${PORT}`);
});
