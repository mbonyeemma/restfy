import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
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

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token       TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);

  CREATE TABLE IF NOT EXISTS registration_otp_tokens (
    email       TEXT PRIMARY KEY COLLATE NOCASE,
    code_hash   TEXT NOT NULL,
    expires_at  INTEGER NOT NULL,
    attempts    INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_registration_otp_expires ON registration_otp_tokens(expires_at);

  -- ── Teams & Collaboration ──────────────────────────────────
  CREATE TABLE IF NOT EXISTS teams (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    created_by  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS team_members (
    team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','admin','member','viewer')),
    joined_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (team_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

  CREATE TABLE IF NOT EXISTS team_invites (
    id          TEXT PRIMARY KEY,
    team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email       TEXT NOT NULL COLLATE NOCASE,
    role        TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin','member','viewer')),
    invited_by  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT UNIQUE NOT NULL,
    expires_at  INTEGER NOT NULL,
    accepted_at INTEGER,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_team_invites_token ON team_invites(token);
  CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email);

  CREATE TABLE IF NOT EXISTS team_collections (
    id          TEXT PRIMARY KEY,
    team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    data        TEXT NOT NULL DEFAULT '{}',
    updated_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_team_collections_team ON team_collections(team_id);

  CREATE TABLE IF NOT EXISTS team_environments (
    id          TEXT PRIMARY KEY,
    team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    data        TEXT NOT NULL DEFAULT '{}',
    updated_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_team_environments_team ON team_environments(team_id);

  CREATE TABLE IF NOT EXISTS team_global_vars (
    team_id     TEXT PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
    data        TEXT NOT NULL DEFAULT '[]',
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- ── Workspaces (organizations) ─────────────────────────────
  CREATE TABLE IF NOT EXISTS workspaces (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    created_by  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','admin','member','viewer')),
    joined_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (workspace_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

  CREATE TABLE IF NOT EXISTS workspace_invites (
    id          TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email       TEXT NOT NULL COLLATE NOCASE,
    role        TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin','member','viewer')),
    invited_by  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT UNIQUE NOT NULL,
    expires_at  INTEGER NOT NULL,
    accepted_at INTEGER,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites(token);
  CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON workspace_invites(email);
`);

const teamCols = db.prepare("PRAGMA table_info(teams)").all() as { name: string }[];
if (!teamCols.some((c) => c.name === "workspace_id")) {
  db.exec(
    "ALTER TABLE teams ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE"
  );
}

const teamsWithoutWorkspace = db
  .prepare("SELECT id, name, slug, created_by, created_at, updated_at FROM teams WHERE workspace_id IS NULL")
  .all() as {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: number;
  updated_at: number;
}[];

if (teamsWithoutWorkspace.length > 0) {
  const insertWs = db.prepare(
    "INSERT INTO workspaces (id, name, slug, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const insertWsMember = db.prepare(
    "INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)"
  );
  const updateTeam = db.prepare("UPDATE teams SET workspace_id = ? WHERE id = ?");
  const teamMembers = db.prepare(
    "SELECT user_id, role, joined_at FROM team_members WHERE team_id = ?"
  );

  const migrateTxn = db.transaction(() => {
    for (const team of teamsWithoutWorkspace) {
      const wsId = uuid();
      const wsSlug = `${team.slug}-ws-${wsId.slice(0, 4)}`;
      insertWs.run(
        wsId,
        `${team.name}`,
        wsSlug,
        team.created_by,
        team.created_at,
        team.updated_at
      );
      const members = teamMembers.all(team.id) as {
        user_id: string;
        role: string;
        joined_at: number;
      }[];
      for (const m of members) {
        const wsRole = m.role === "owner" ? "owner" : m.role;
        insertWsMember.run(wsId, m.user_id, wsRole, m.joined_at);
      }
      updateTeam.run(wsId, team.id);
    }
  });
  migrateTxn();
}

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
