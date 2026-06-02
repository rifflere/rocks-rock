/**
 * Daily reset scheduler.
 *
 * Uses node-cron to fire the rock regeneration job at midnight every day.
 * Also runs once at startup if the road hasn't been reset in the last 24 hours.
 *
 * Cron expression "0 0 * * *" = "at 00:00 every day".
 */

import cron from 'node-cron';
import { generateRoadRocks, needsReset } from './rockGenerator';

/**
 * Initializes the scheduler.
 * Call this once from app.ts after the DB is ready and rock types are seeded.
 */
export function startScheduler(): void {
  // Run immediately on startup if rocks are stale or missing.
  if (needsReset()) {
    console.log('[scheduler] Rocks are stale or missing — generating now...');
    generateRoadRocks();
  } else {
    console.log('[scheduler] Road rocks are fresh — no immediate regeneration needed.');
  }

  // Schedule daily midnight reset (server local time).
  cron.schedule('0 0 * * *', () => {
    console.log('[scheduler] Midnight reset triggered.');
    generateRoadRocks();
  });

  console.log('[scheduler] Daily reset scheduled for midnight.');
}
