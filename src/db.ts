import { createRequire } from "node:module";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: typeof DatabaseSyncType;
};

export type { DatabaseSyncType as DatabaseSync };

export function createDatabase(dbPath: string = ":memory:"): DatabaseSyncType {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS spaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK(type IN ('MEETING_ROOM', 'PHONE_BOOTH', 'DEDICATED_DESK', 'AUDITORIUM')),
      capacity INTEGER NOT NULL CHECK(capacity >= 1),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      title TEXT NOT NULL,
      attendees_count INTEGER NOT NULL CHECK(attendees_count >= 1),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('CONFIRMED', 'CANCELLED')),
      created_at TEXT NOT NULL,
      cancelled_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_reservations_overlap
      ON reservations (space_id, status, start_time, end_time);

    CREATE TABLE IF NOT EXISTS maintenance_blocks (
      id TEXT PRIMARY KEY,
      space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_maintenance_space_time
      ON maintenance_blocks (space_id, start_time, end_time);
  `);

  return db;
}
