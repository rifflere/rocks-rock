/**
 * Shelf controller (Trophy Shelf view).
 *
 * Manages the communal trophy shelf — rocks that have been collected,
 * named, and placed on display for everyone to see.
 *
 * Routes handled:
 *   GET    /api/shelf        — list all shelf rocks, newest first
 *   POST   /api/shelf        — add a collected road rock to the shelf
 *   DELETE /api/shelf/:id   — remove a rock from the shelf (and cascade-delete its journal entry)
 *
 * Shelf cap: 300 rocks maximum. Adding when full rejects with 429.
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../models/db';
import { filterNickname } from '../services/profanityFilter';
import { generateJournalText } from './journalController';

const SHELF_MAX = 300;

/** Shape of a shelf_rocks row joined with rock_types. */
interface ShelfRockRow {
  id: string;
  rock_type_id: number;
  nickname: string | null;
  size_mm: number;
  collected_at: string;
  rt_name: string;
  rt_category: string;
  rt_rarity_score: number;
  rt_color_primary: string;
  rt_color_secondary: string | null;
  rt_size_range_min_mm: number;
  rt_size_range_max_mm: number;
  rt_hardness_min: number | null;
  rt_hardness_max: number | null;
  rt_luster: string | null;
  rt_texture: string | null;
  rt_description: string;
  rt_fun_fact: string | null;
}

const SELECT_SHELF_SQL = `
  SELECT
    sr.id,
    sr.rock_type_id,
    sr.nickname,
    sr.size_mm,
    sr.collected_at,
    rt.name              AS rt_name,
    rt.category          AS rt_category,
    rt.rarity_score      AS rt_rarity_score,
    rt.color_primary     AS rt_color_primary,
    rt.color_secondary   AS rt_color_secondary,
    rt.size_range_min_mm AS rt_size_range_min_mm,
    rt.size_range_max_mm AS rt_size_range_max_mm,
    rt.hardness_min      AS rt_hardness_min,
    rt.hardness_max      AS rt_hardness_max,
    rt.luster            AS rt_luster,
    rt.texture           AS rt_texture,
    rt.description       AS rt_description,
    rt.fun_fact          AS rt_fun_fact
  FROM shelf_rocks sr
  JOIN rock_types rt ON rt.id = sr.rock_type_id
  ORDER BY sr.collected_at DESC
`;

function toApiShape(row: ShelfRockRow) {
  return {
    id: row.id,
    rockTypeId: row.rock_type_id,
    nickname: row.nickname,
    sizeMm: row.size_mm,
    collectedAt: row.collected_at,
    rockType: {
      id: row.rock_type_id,
      name: row.rt_name,
      category: row.rt_category,
      rarityScore: row.rt_rarity_score,
      colorPrimary: row.rt_color_primary,
      colorSecondary: row.rt_color_secondary,
      sizeRangeMinMm: row.rt_size_range_min_mm,
      sizeRangeMaxMm: row.rt_size_range_max_mm,
      hardnessMin: row.rt_hardness_min,
      hardnessMax: row.rt_hardness_max,
      luster: row.rt_luster,
      texture: row.rt_texture,
      description: row.rt_description,
      funFact: row.rt_fun_fact,
    },
  };
}

/** GET /api/shelf — all shelf rocks, newest first. */
export function getShelf(_req: Request, res: Response): void {
  const rows = db.prepare(SELECT_SHELF_SQL).all() as ShelfRockRow[];
  res.json(rows.map(toApiShape));
}

/**
 * POST /api/shelf
 * Body: { roadRockId, rockTypeId, sizeMm, nickname? }
 *
 * Adds a rock to the shelf and creates its journal entry.
 * The roadRockId is used only to look up the rock type for validation —
 * the road_rocks.is_collected flag was already set by collectRock().
 */
export function addToShelf(req: Request, res: Response): void {
  const { roadRockId, rockTypeId, sizeMm, nickname } = req.body as {
    roadRockId?: string;
    rockTypeId?: number;
    sizeMm?: number;
    nickname?: string;
  };

  // Basic input validation.
  if (!roadRockId || rockTypeId === undefined || sizeMm === undefined) {
    res.status(400).json({ error: 'roadRockId, rockTypeId, and sizeMm are required.' });
    return;
  }

  // Verify the road rock was actually collected.
  const roadRock = db
    .prepare('SELECT id, is_collected FROM road_rocks WHERE id = ?')
    .get(roadRockId) as { id: string; is_collected: number } | undefined;

  if (!roadRock || roadRock.is_collected === 0) {
    res.status(400).json({ error: 'Road rock must be collected before shelving.' });
    return;
  }

  // Verify rock type exists.
  const rockType = db
    .prepare('SELECT id, name FROM rock_types WHERE id = ?')
    .get(rockTypeId) as { id: number; name: string } | undefined;

  if (!rockType) {
    res.status(400).json({ error: 'Invalid rock type.' });
    return;
  }

  // Validate size range.
  const typeRange = db
    .prepare('SELECT size_range_min_mm, size_range_max_mm FROM rock_types WHERE id = ?')
    .get(rockTypeId) as { size_range_min_mm: number; size_range_max_mm: number };

  if (sizeMm < typeRange.size_range_min_mm - 1 || sizeMm > typeRange.size_range_max_mm + 1) {
    res.status(400).json({ error: 'sizeMm out of valid range for this rock type.' });
    return;
  }

  // Enforce shelf cap.
  const count = (db.prepare('SELECT COUNT(*) AS n FROM shelf_rocks').get() as { n: number }).n;
  if (count >= SHELF_MAX) {
    res.status(429).json({ error: `The shelf is full! (Max ${SHELF_MAX} rocks)` });
    return;
  }

  // Filter nickname if provided.
  let cleanNickname: string | null = null;
  if (nickname && nickname.trim().length > 0) {
    const result = filterNickname(nickname);
    if (result.isProfane) {
      res.status(400).json({ error: 'That name is not allowed. Please choose something else.' });
      return;
    }
    cleanNickname = result.clean || null;
  }

  // Insert into shelf and journal atomically.
  const shelfId = uuidv4();
  const journalId = uuidv4();
  const journalText = generateJournalText(rockType.name, sizeMm, cleanNickname);

  const insertShelf = db.prepare(`
    INSERT INTO shelf_rocks (id, rock_type_id, nickname, size_mm)
    VALUES (?, ?, ?, ?)
  `);
  const insertJournal = db.prepare(`
    INSERT INTO journal_entries (id, shelf_rock_id, auto_text)
    VALUES (?, ?, ?)
  `);

  db.transaction(() => {
    insertShelf.run(shelfId, rockTypeId, cleanNickname, sizeMm);
    insertJournal.run(journalId, shelfId, journalText);
  })();

  // Return the newly created shelf rock.
  const newRow = db.prepare(`${SELECT_SHELF_SQL.replace('ORDER BY sr.collected_at DESC', 'WHERE sr.id = ?')}`).get(shelfId) as ShelfRockRow;
  res.status(201).json(toApiShape(newRow));
}

/**
 * DELETE /api/shelf/:id
 * Removes a rock from the shelf. The ON DELETE CASCADE in the schema
 * automatically deletes the associated journal entry.
 */
export function deleteFromShelf(req: Request, res: Response): void {
  const { id } = req.params;

  const existing = db
    .prepare('SELECT id FROM shelf_rocks WHERE id = ?')
    .get(id) as { id: string } | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Shelf rock not found.' });
    return;
  }

  db.prepare('DELETE FROM shelf_rocks WHERE id = ?').run(id);
  res.json({ success: true });
}
