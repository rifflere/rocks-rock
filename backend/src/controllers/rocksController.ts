/**
 * Rocks controller (Road view).
 *
 * Handles all HTTP requests related to rocks on the road.
 * Every DB query uses parameterized statements — no string interpolation —
 * so SQL injection is not possible at this layer.
 *
 * Routes handled (defined in routes/index.ts):
 *   GET  /api/rocks         — list all uncollected road rocks with their type data
 *   POST /api/rocks/:id/collect — mark a road rock as collected (remove from road)
 */

import { Request, Response } from 'express';
import db from '../models/db';

/** Shape of a road_rock row joined with its rock_type. */
interface RoadRockRow {
  id: string;
  type_id: number;
  canvas_x: number;
  canvas_y: number;
  size_mm: number;
  is_collected: number;
  generated_at: string;
  // joined rock_type fields (prefixed to avoid column name collisions)
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

/** SQL that fetches road rocks with their rock type data in one join. */
const SELECT_ROCKS_SQL = `
  SELECT
    rr.id,
    rr.type_id,
    rr.canvas_x,
    rr.canvas_y,
    rr.size_mm,
    rr.is_collected,
    rr.generated_at,
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
  FROM road_rocks rr
  JOIN rock_types rt ON rt.id = rr.type_id
  WHERE rr.is_collected = 0
  ORDER BY rr.canvas_y ASC, rr.canvas_x ASC
`;

/** Transforms a flat joined row into the nested API shape the frontend expects. */
function toApiShape(row: RoadRockRow) {
  return {
    id: row.id,
    typeId: row.type_id,
    canvasX: row.canvas_x,
    canvasY: row.canvas_y,
    sizeMm: row.size_mm,
    isCollected: row.is_collected === 1,
    generatedAt: row.generated_at,
    rockType: {
      id: row.type_id,
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

/**
 * GET /api/rocks
 * Returns all uncollected road rocks, each with their rock type info.
 */
export function getRocks(_req: Request, res: Response): void {
  const rows = db.prepare(SELECT_ROCKS_SQL).all() as RoadRockRow[];
  res.json(rows.map(toApiShape));
}

/**
 * POST /api/rocks/:id/collect
 * Marks a road rock as collected so it disappears from the road for everyone.
 * The frontend calls this when a rock is dropped into the basket.
 * The rock is NOT added to the shelf here — that happens in shelfController
 * when the user submits the naming dialog.
 */
export function collectRock(req: Request, res: Response): void {
  const { id } = req.params;

  // Check the rock exists and is not already collected.
  const existing = db
    .prepare('SELECT id, is_collected FROM road_rocks WHERE id = ?')
    .get(id) as { id: string; is_collected: number } | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Rock not found.' });
    return;
  }

  if (existing.is_collected === 1) {
    res.status(409).json({ error: 'Rock already collected.' });
    return;
  }

  db.prepare('UPDATE road_rocks SET is_collected = 1 WHERE id = ?').run(id);
  res.json({ success: true });
}
