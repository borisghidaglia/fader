import { mkdirSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

// Shared by the Next.js server and the sync worker (a separate process).
// WAL mode lets the web app read while the worker writes.

const DB_PATH =
  process.env.FEED_DB_PATH ?? path.join(process.cwd(), "data", "feed.db")

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id              TEXT PRIMARY KEY,
  handle          TEXT NOT NULL,
  name            TEXT NOT NULL,
  avatar_url      TEXT,
  bio             TEXT,
  followers_count INTEGER NOT NULL DEFAULT 0,
  verified        INTEGER NOT NULL DEFAULT 0,
  protected       INTEGER NOT NULL DEFAULT 0,
  following       INTEGER NOT NULL DEFAULT 1,
  follow_order    INTEGER,          -- 0 = the account you followed most recently
  ratio           REAL,             -- NULL = use the default ratio
  newest_seen_id  TEXT,             -- newest tweet seen on the account's own timeline
  covered_since   INTEGER,          -- its timeline is read without gaps back to here (0 = all of it)
  next_sync_at    INTEGER NOT NULL DEFAULT 0,
  last_synced_at  INTEGER,
  last_error      TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS tweets (
  id              TEXT PRIMARY KEY,
  author_id       TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,    -- 'post' | 'quote' | 'reply'
  created_at      INTEGER NOT NULL,
  reply_to_id     TEXT,
  reply_to_handle TEXT,
  content         TEXT NOT NULL,    -- JSON, see TweetContent
  likes           INTEGER NOT NULL,
  reposts         INTEGER NOT NULL,
  replies         INTEGER NOT NULL,
  quotes          INTEGER NOT NULL,
  bookmarks       INTEGER NOT NULL,
  views           INTEGER,
  metrics_at      INTEGER NOT NULL, -- when the metrics above were observed
  score           REAL,             -- projected lifetime engagement
  top             REAL              -- rank within the author's recent output: 0 = best, 1 = worst
) STRICT;

CREATE INDEX IF NOT EXISTS tweets_by_time ON tweets (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS tweets_by_author ON tweets (author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS kv (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;
`

declare global {
  var __feedDb: DatabaseSync | undefined
}

export function getDb(): DatabaseSync {
  if (!globalThis.__feedDb) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true })
    const db = new DatabaseSync(DB_PATH)
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      PRAGMA foreign_keys = ON;
    `)
    db.exec(SCHEMA)
    migrate(db)
    globalThis.__feedDb = db
  }
  return globalThis.__feedDb
}

/** Brings databases created by earlier versions up to SCHEMA. */
function migrate(db: DatabaseSync) {
  const columns = db.prepare("SELECT name FROM pragma_table_info('accounts')").all()
  if (!columns.some((c) => c.name === "covered_since")) {
    db.exec("ALTER TABLE accounts ADD COLUMN covered_since INTEGER")
  }
}

export function transaction<T>(fn: () => T): T {
  const db = getDb()
  db.exec("BEGIN IMMEDIATE")
  try {
    const result = fn()
    db.exec("COMMIT")
    return result
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}
