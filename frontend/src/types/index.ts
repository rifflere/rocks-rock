/**
 * Shared TypeScript types used across the frontend.
 * Keep this in sync with the backend's data shapes.
 */

/** A rock type definition — the static "species" data seeded into the DB. */
export interface RockType {
  id: number;
  name: string;
  /** igneous | sedimentary | metamorphic | mineral */
  category: string;
  /** 1 (extremely common) – 10 (ultra rare) */
  rarityScore: number;
  /** Primary fill color (CSS hex string, e.g. "#A08060") */
  colorPrimary: string;
  /** Optional secondary/accent color for texture rendering */
  colorSecondary: string | null;
  /** Minimum real-world size in millimeters */
  sizeRangeMinMm: number;
  /** Maximum real-world size in millimeters */
  sizeRangeMaxMm: number;
  /** Mohs hardness scale minimum (1 soft – 10 diamond) */
  hardnessMin: number | null;
  /** Mohs hardness scale maximum */
  hardnessMax: number | null;
  /** How light reflects: glassy | waxy | metallic | pearly | resinous | silky | adamantine | dull */
  luster: string | null;
  /** Surface feel: smooth | rough | crystalline | granular | foliated */
  texture: string | null;
  description: string;
  funFact: string | null;
}

/** A single rock currently sitting on the road (fetched from /api/rocks). */
export interface RoadRock {
  id: string;
  typeId: number;
  rockType: RockType;
  /** Normalized X position 0–1 (scaled to canvas width on frontend) */
  canvasX: number;
  /** Normalized Y position 0–1 (scaled to canvas height on frontend) */
  canvasY: number;
  /** Actual size in millimeters (random within type's range) */
  sizeMm: number;
  isCollected: boolean;
  generatedAt: string;
}

/** A rock on the communal trophy shelf. */
export interface ShelfRock {
  id: string;
  rockTypeId: number;
  rockType: RockType;
  /** User-supplied name, or null if they skipped naming */
  nickname: string | null;
  sizeMm: number;
  collectedAt: string;
}

/** A single entry in the communal journal (one entry per shelf rock). */
export interface JournalEntry {
  id: string;
  shelfRockId: string;
  /** Auto-generated flavor text describing the find */
  autoText: string;
  createdAt: string;
  /** Joined from shelf_rocks for display convenience */
  shelfRock?: ShelfRock;
}

/** State for the "currently dragged rock" while in-flight from road to basket. */
export interface DragState {
  rock: RoadRock;
  /** Current pointer X in canvas-space pixels */
  pointerX: number;
  /** Current pointer Y in canvas-space pixels */
  pointerY: number;
}

/** Which of the three main views is active. */
export type AppView = 'road' | 'shelf' | 'journal';
