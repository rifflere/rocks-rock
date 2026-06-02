/**
 * Journal controller.
 *
 * The journal is a communal "vade mecum" — one entry per shelf rock,
 * auto-generated when the rock is shelved. Users can delete entries
 * (which also deletes the associated shelf rock via cascade).
 *
 * Routes handled:
 *   GET    /api/journal       — all entries, newest first, with shelf rock data
 *   DELETE /api/journal/:id   — delete a journal entry (cascades to shelf rock)
 *
 * Also exports generateJournalText() used by shelfController.
 */

import { Request, Response } from 'express';
import db from '../models/db';

// ─── Journal flavor text generation ──────────────────────────────────────────

/** Opening exclamations used when a rock has a nickname. */
const NAMED_OPENERS = [
  'Found it!',
  'Ooh, a keeper!',
  'Score!',
  'What a find!',
  'Oh, it\'s perfect.',
  'Couldn\'t leave this one behind.',
  'Beautiful.',
  'Hello there, little one.',
  'Oh my.',
  'Speechless.',
];

/** Opening exclamations used when the rock has no nickname. */
const UNNAMED_OPENERS = [
  'Ooh, shiny!',
  'Would you look at that.',
  'A mystery rock!',
  'Gorgeous.',
  'Perfection.',
  'How did I get so lucky?',
  'Nature is wild.',
  'Didn\'t expect to find one of these.',
  'What a day!',
  'Into the collection it goes.',
];

/** Size descriptions keyed by approximate size range. */
function sizeDescription(sizeMm: number): string {
  if (sizeMm < 10) return 'a tiny little pebble';
  if (sizeMm < 25) return 'a small, pocket-sized stone';
  if (sizeMm < 50) return 'a satisfying medium-sized rock';
  if (sizeMm < 80) return 'a substantial, weighty rock';
  return 'a big impressive specimen';
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates the auto-text for a new journal entry.
 * Called by shelfController when a rock is added to the shelf.
 */
export function generateJournalText(
  rockName: string,
  sizeMm: number,
  nickname: string | null,
): string {
  const opener = nickname
    ? randomFrom(NAMED_OPENERS)
    : randomFrom(UNNAMED_OPENERS);

  const size = sizeDescription(sizeMm);
  const displayName = nickname ? `"${nickname}"` : `this ${rockName}`;

  return `${opener} Added ${displayName} — ${size} — to the shelf today. ${rockName} always belonged here.`;
}

// ─── Controller handlers ──────────────────────────────────────────────────────

interface JournalRow {
  id: string;
  shelf_rock_id: string;
  auto_text: string;
  created_at: string;
  // joined shelf rock fields
  sr_nickname: string | null;
  sr_size_mm: number;
  sr_collected_at: string;
  sr_rock_type_id: number;
  rt_name: string;
  rt_rarity_score: number;
  rt_color_primary: string;
}

const SELECT_JOURNAL_SQL = `
  SELECT
    je.id,
    je.shelf_rock_id,
    je.auto_text,
    je.created_at,
    sr.nickname        AS sr_nickname,
    sr.size_mm         AS sr_size_mm,
    sr.collected_at    AS sr_collected_at,
    sr.rock_type_id    AS sr_rock_type_id,
    rt.name            AS rt_name,
    rt.rarity_score    AS rt_rarity_score,
    rt.color_primary   AS rt_color_primary
  FROM journal_entries je
  JOIN shelf_rocks sr ON sr.id = je.shelf_rock_id
  JOIN rock_types  rt ON rt.id = sr.rock_type_id
  ORDER BY je.created_at DESC
`;

function toApiShape(row: JournalRow) {
  return {
    id: row.id,
    shelfRockId: row.shelf_rock_id,
    autoText: row.auto_text,
    createdAt: row.created_at,
    shelfRock: {
      id: row.shelf_rock_id,
      rockTypeId: row.sr_rock_type_id,
      nickname: row.sr_nickname,
      sizeMm: row.sr_size_mm,
      collectedAt: row.sr_collected_at,
      rockType: {
        id: row.sr_rock_type_id,
        name: row.rt_name,
        rarityScore: row.rt_rarity_score,
        colorPrimary: row.rt_color_primary,
      },
    },
  };
}

/** GET /api/journal — all entries newest-first. */
export function getJournal(_req: Request, res: Response): void {
  const rows = db.prepare(SELECT_JOURNAL_SQL).all() as JournalRow[];
  res.json(rows.map(toApiShape));
}

/**
 * DELETE /api/journal/:id
 * Deletes a journal entry AND its associated shelf rock (cascade handled in SQL).
 * This is how the user removes a rock from the journal (the little "×" on each page).
 */
export function deleteJournalEntry(req: Request, res: Response): void {
  const { id } = req.params;

  const entry = db
    .prepare('SELECT id, shelf_rock_id FROM journal_entries WHERE id = ?')
    .get(id) as { id: string; shelf_rock_id: string } | undefined;

  if (!entry) {
    res.status(404).json({ error: 'Journal entry not found.' });
    return;
  }

  // Deleting the shelf rock cascades to delete the journal entry.
  db.prepare('DELETE FROM shelf_rocks WHERE id = ?').run(entry.shelf_rock_id);
  res.json({ success: true });
}
