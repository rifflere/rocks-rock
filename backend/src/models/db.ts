/**
 * Database singleton.
 *
 * Opens (or creates) the SQLite database at the path specified in DB_PATH.
 * Runs CREATE TABLE IF NOT EXISTS statements on startup so the schema
 * is always up-to-date without separate migration tooling.
 *
 * better-sqlite3 is synchronous, which pairs naturally with Express
 * request handlers — no callback/promise juggling needed.
 */

import Database from 'better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = process.env.DB_PATH ?? './rocks.db';

// ':memory:' is a special SQLite keyword — path.resolve() would corrupt it.
const resolvedPath = DB_PATH === ':memory:' ? ':memory:' : path.resolve(DB_PATH);

/** Single shared DB connection used across all controllers. */
const db = new Database(resolvedPath);

// Enable WAL (Write-Ahead Logging) mode for better concurrent read performance.
db.pragma('journal_mode = WAL');
// Enforce foreign key constraints (SQLite doesn't enable these by default).
db.pragma('foreign_keys = ON');

/**
 * Bootstrap the schema.
 * All tables use IF NOT EXISTS so this is safe to call on every startup.
 */
db.exec(`
  -- ─── rock_types ────────────────────────────────────────────────────────────
  -- Static "species" catalog seeded once at startup.
  CREATE TABLE IF NOT EXISTS rock_types (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    name              TEXT    NOT NULL,
    category          TEXT    NOT NULL CHECK(category IN ('igneous','sedimentary','metamorphic','mineral')),
    rarity_score      INTEGER NOT NULL CHECK(rarity_score BETWEEN 1 AND 10),
    spawn_weight      REAL    NOT NULL,        -- relative probability; higher = more common
    color_primary     TEXT    NOT NULL,        -- CSS hex, e.g. "#A08060"
    color_secondary   TEXT,                   -- optional accent hex
    size_range_min_mm REAL    NOT NULL,
    size_range_max_mm REAL    NOT NULL,
    hardness_min      REAL,                   -- Mohs scale
    hardness_max      REAL,
    luster            TEXT,
    texture           TEXT,
    description       TEXT    NOT NULL,
    fun_fact          TEXT
  );

  -- ─── road_rocks ────────────────────────────────────────────────────────────
  -- Rocks currently (or recently) on the road. Reset every 24 hours.
  CREATE TABLE IF NOT EXISTS road_rocks (
    id            TEXT    PRIMARY KEY,          -- UUID v4
    type_id       INTEGER NOT NULL REFERENCES rock_types(id),
    canvas_x      REAL    NOT NULL,             -- normalized 0–1 (x position on road)
    canvas_y      REAL    NOT NULL,             -- normalized 0–1 (y position on road)
    size_mm       REAL    NOT NULL,
    is_collected  INTEGER NOT NULL DEFAULT 0,   -- 0 = on road, 1 = picked up
    generated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    reset_at      TEXT    NOT NULL              -- timestamp of the batch that created this rock
  );

  -- ─── shelf_rocks ───────────────────────────────────────────────────────────
  -- Communal trophy shelf. Every collected + named rock lands here.
  CREATE TABLE IF NOT EXISTS shelf_rocks (
    id           TEXT    PRIMARY KEY,            -- UUID v4
    rock_type_id INTEGER NOT NULL REFERENCES rock_types(id),
    nickname     TEXT,                           -- user-provided name (profanity-filtered)
    size_mm      REAL    NOT NULL,
    collected_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- ─── journal_entries ───────────────────────────────────────────────────────
  -- One entry per shelf rock. Auto-generated flavor text.
  CREATE TABLE IF NOT EXISTS journal_entries (
    id             TEXT PRIMARY KEY,
    shelf_rock_id  TEXT NOT NULL REFERENCES shelf_rocks(id) ON DELETE CASCADE,
    auto_text      TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ─── metadata ──────────────────────────────────────────────────────────────
  -- Key-value store for app state (e.g. last road reset timestamp).
  CREATE TABLE IF NOT EXISTS metadata (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export default db;
