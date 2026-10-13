/**
 * schema.ts
 *
 * Creates all tables and indexes on startup (IF NOT EXISTS, so it is safe to
 * run every boot) and stamps PRAGMA user_version = 1.
 *
 * Timestamps are always epoch milliseconds (INTEGER). See README for the
 * semantics of watchdog_log: one row per continuous period of identical
 * state, never one row per run.
 */
import type { Db } from './connection.js';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS watchdog (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL UNIQUE COLLATE NOCASE,
  mode              TEXT NOT NULL CHECK (mode IN ('active','passive')),
  url               TEXT,
  expected_status   TEXT,
  heartbeat_secret  TEXT,
  last_heartbeat_at INTEGER,
  enabled           INTEGER NOT NULL DEFAULT 1,
  notify            INTEGER NOT NULL DEFAULT 1,
  threshold_minutes INTEGER NOT NULL DEFAULT 3,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);

-- One row per continuous period of identical state. Never one row per run.
CREATE TABLE IF NOT EXISTS watchdog_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  watchdog_id TEXT NOT NULL REFERENCES watchdog(id) ON DELETE CASCADE,
  status      INTEGER NOT NULL CHECK (status IN (0,1)),
  note        TEXT NOT NULL,
  started_at  INTEGER NOT NULL,
  ended_at    INTEGER NOT NULL,
  counter     INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_log_wd_ended ON watchdog_log(watchdog_id, ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_log_started ON watchdog_log(started_at);

-- Persisted notification tracking (survives restarts).
CREATE TABLE IF NOT EXISTS notification_state (
  watchdog_id   TEXT PRIMARY KEY REFERENCES watchdog(id) ON DELETE CASCADE,
  down_since    INTEGER,
  down_notified INTEGER NOT NULL DEFAULT 0
);

-- History of sent/failed emails.
CREATE TABLE IF NOT EXISTS notification_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  watchdog_id TEXT NOT NULL REFERENCES watchdog(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('down','up')),
  sent_at     INTEGER NOT NULL,
  success     INTEGER NOT NULL,
  error       TEXT
);

PRAGMA user_version = 1;
`;

/** Create tables/indexes if they do not exist yet. */
export async function applySchema(db: Db): Promise<void> {
  await db.exec(SCHEMA_SQL);
}
