/**
 * API router.
 * Maps URL paths to controller functions. All routes are prefixed with /api
 * by the time they reach this router (set in app.ts).
 */

import { Router } from 'express';
import { getRocks, collectRock } from '../controllers/rocksController';
import { getShelf, addToShelf, deleteFromShelf } from '../controllers/shelfController';
import { getJournal, deleteJournalEntry } from '../controllers/journalController';

const router = Router();

// ── Road rocks ──────────────────────────────────────────────────────────────
router.get('/rocks', getRocks);
router.post('/rocks/:id/collect', collectRock);

// ── Trophy shelf ─────────────────────────────────────────────────────────────
router.get('/shelf', getShelf);
router.post('/shelf', addToShelf);
router.delete('/shelf/:id', deleteFromShelf);

// ── Journal ──────────────────────────────────────────────────────────────────
router.get('/journal', getJournal);
router.delete('/journal/:id', deleteJournalEntry);

export default router;
