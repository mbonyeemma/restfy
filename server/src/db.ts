import fs from "fs";
import path from "path";
import Database, { type Database as DatabaseType } from "better-sqlite3";
import { ANONYMOUS_USER_ID } from "./config/constants";

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const db: DatabaseType = new Database(path.join(DATA_DIR, "restfy.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL COLLATE NOCASE,
    name        TEXT NOT NULL DEFAULT '',
    password    TEXT NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS collections (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data        TEXT NOT NULL DEFAULT '{}',
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);

  CREATE TABLE IF NOT EXISTS environments (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data        TEXT NOT NULL DEFAULT '{}',
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_environments_user ON environments(user_id);

  CREATE TABLE IF NOT EXISTS global_vars (
    user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data        TEXT NOT NULL DEFAULT '[]',
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS shared_docs (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    collection_id TEXT NOT NULL,
    slug        TEXT UNIQUE,
    data        TEXT NOT NULL DEFAULT '{}',
    views       INTEGER NOT NULL DEFAULT 0,
    is_public   INTEGER NOT NULL DEFAULT 1,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_shared_user ON shared_docs(user_id);

  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device      TEXT DEFAULT '',
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`);

const anonEmail = "anonymous@restfy.local";
const existingAnon = db.prepare("SELECT id FROM users WHERE id = ?").get(ANONYMOUS_USER_ID);
if (!existingAnon) {
  db.prepare(
    "INSERT INTO users (id, email, name, password) VALUES (?, ?, ?, ?)"
  ).run(ANONYMOUS_USER_ID, anonEmail, "Anonymous", "");
  db.prepare("INSERT INTO global_vars (user_id, data) VALUES (?, ?)").run(
    ANONYMOUS_USER_ID,
    "[]"
  );
}

export default db;
