import crypto from "crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import { v4 as uuid } from "uuid";
import { authMiddleware } from "../auth";
import db from "../db";
import { sendTeamInviteEmail } from "../lib/email";

const router = Router();
router.use(authMiddleware);

type TeamRow = {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: number;
  updated_at: number;
};

type MemberRow = {
  team_id: string;
  user_id: string;
  role: string;
  joined_at: number;
};

type InviteRow = {
  id: string;
  team_id: string;
  email: string;
  role: string;
  invited_by: string;
  token: string;
  expires_at: number;
  accepted_at: number | null;
  created_at: number;
};

// ── Role helpers ──────────────────────────────────────────────

function getMemberRole(teamId: string, userId: string): string | null {
  const row = db
    .prepare("SELECT role FROM team_members WHERE team_id = ? AND user_id = ?")
    .get(teamId, userId) as { role: string } | undefined;
  return row?.role ?? null;
}

function requireRole(
  ...allowed: string[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const teamId = req.params.teamId;
    const role = getMemberRole(teamId, req.userId!);
    if (!role) {
      res.status(403).json({ error: "You are not a member of this team" });
      return;
    }
    if (!allowed.includes(role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    (req as any).teamRole = role;
    next();
  };
}

// ── Create team ───────────────────────────────────────────────

router.post("/", (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: "Team name is required" });
    return;
  }

  const id = uuid();
  const slug =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    id.slice(0, 4);

  db.prepare("INSERT INTO teams (id, name, slug, created_by) VALUES (?, ?, ?, ?)").run(
    id,
    name.trim(),
    slug,
    req.userId!
  );

  db.prepare(
    "INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'owner')"
  ).run(id, req.userId!);

  db.prepare("INSERT INTO team_global_vars (team_id, data) VALUES (?, '[]')").run(id);

  res.status(201).json({ id, name: name.trim(), slug, role: "owner" });
});

// ── List my teams ─────────────────────────────────────────────

router.get("/", (req: Request, res: Response) => {
  const rows = db
    .prepare(
      `SELECT t.id, t.name, t.slug, t.created_at, tm.role,
              (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(req.userId!) as (TeamRow & { role: string; member_count: number })[];

  res.json({ teams: rows });
});

// ── Get team details ──────────────────────────────────────────

router.get(
  "/:teamId",
  requireRole("owner", "admin", "member", "viewer"),
  (req: Request, res: Response) => {
    const team = db.prepare("SELECT * FROM teams WHERE id = ?").get(req.params.teamId) as
      | TeamRow
      | undefined;
    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }

    const members = db
      .prepare(
        `SELECT tm.user_id, tm.role, tm.joined_at, u.email, u.name
         FROM team_members tm
         JOIN users u ON u.id = tm.user_id
         WHERE tm.team_id = ?
         ORDER BY tm.joined_at ASC`
      )
      .all(team.id) as {
      user_id: string;
      role: string;
      joined_at: number;
      email: string;
      name: string;
    }[];

    const pendingInvites = db
      .prepare(
        "SELECT id, email, role, created_at FROM team_invites WHERE team_id = ? AND accepted_at IS NULL AND expires_at > unixepoch()"
      )
      .all(team.id) as { id: string; email: string; role: string; created_at: number }[];

    res.json({ team, members, pendingInvites, myRole: (req as any).teamRole });
  }
);

// ── Update team ───────────────────────────────────────────────

router.patch(
  "/:teamId",
  requireRole("owner", "admin"),
  (req: Request, res: Response) => {
    const { name } = req.body as { name?: string };
    if (name !== undefined) {
      db.prepare("UPDATE teams SET name = ?, updated_at = unixepoch() WHERE id = ?").run(
        name.trim(),
        req.params.teamId
      );
    }
    const team = db.prepare("SELECT * FROM teams WHERE id = ?").get(req.params.teamId) as TeamRow;
    res.json({ team });
  }
);

// ── Delete team ───────────────────────────────────────────────

router.delete(
  "/:teamId",
  requireRole("owner"),
  (req: Request, res: Response) => {
    db.prepare("DELETE FROM teams WHERE id = ?").run(req.params.teamId);
    res.json({ ok: true });
  }
);

// ── Invite member ─────────────────────────────────────────────

router.post(
  "/:teamId/invite",
  requireRole("owner", "admin"),
  (req: Request, res: Response) => {
    const { email, role } = req.body as { email?: string; role?: string };
    if (!email?.trim()) {
      res.status(400).json({ error: "Email is required" });
      return;
    }
    const inviteRole = role && ["admin", "member", "viewer"].includes(role) ? role : "member";

    const existing = db
      .prepare("SELECT user_id FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = ? AND u.email = ?")
      .get(req.params.teamId, email.trim().toLowerCase()) as { user_id: string } | undefined;
    if (existing) {
      res.status(409).json({ error: "This user is already a team member" });
      return;
    }

    const pendingDupe = db
      .prepare(
        "SELECT id FROM team_invites WHERE team_id = ? AND email = ? AND accepted_at IS NULL AND expires_at > unixepoch()"
      )
      .get(req.params.teamId, email.trim().toLowerCase()) as { id: string } | undefined;
    if (pendingDupe) {
      res.status(409).json({ error: "An invitation is already pending for this email" });
      return;
    }

    const id = uuid();
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days

    db.prepare(
      "INSERT INTO team_invites (id, team_id, email, role, invited_by, token, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, req.params.teamId, email.trim().toLowerCase(), inviteRole, req.userId!, token, expiresAt);

    const inviter = db
      .prepare("SELECT name, email FROM users WHERE id = ?")
      .get(req.userId!) as { name: string; email: string };
    const team = db.prepare("SELECT name FROM teams WHERE id = ?").get(req.params.teamId) as {
      name: string;
    };

    void sendTeamInviteEmail(
      email.trim(),
      inviter.name || inviter.email,
      team.name,
      token,
      inviteRole
    ).catch((err) => console.error("[email] team invite:", err));

    res.status(201).json({ ok: true, inviteId: id });
  }
);

// ── Accept invite (by token) ──────────────────────────────────

router.post("/accept-invite", (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: "Invite token is required" });
    return;
  }

  const invite = db
    .prepare(
      "SELECT * FROM team_invites WHERE token = ? AND accepted_at IS NULL AND expires_at > unixepoch()"
    )
    .get(token) as InviteRow | undefined;
  if (!invite) {
    res.status(400).json({ error: "Invalid or expired invitation" });
    return;
  }

  const alreadyMember = db
    .prepare("SELECT user_id FROM team_members WHERE team_id = ? AND user_id = ?")
    .get(invite.team_id, req.userId!) as { user_id: string } | undefined;
  if (alreadyMember) {
    db.prepare("UPDATE team_invites SET accepted_at = unixepoch() WHERE id = ?").run(invite.id);
    res.json({ ok: true, teamId: invite.team_id, alreadyMember: true });
    return;
  }

  db.prepare(
    "INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)"
  ).run(invite.team_id, req.userId!, invite.role);

  db.prepare("UPDATE team_invites SET accepted_at = unixepoch() WHERE id = ?").run(invite.id);

  const team = db.prepare("SELECT id, name, slug FROM teams WHERE id = ?").get(invite.team_id) as TeamRow;
  res.json({ ok: true, team: { id: team.id, name: team.name, slug: team.slug }, role: invite.role });
});

// ── Cancel invite ─────────────────────────────────────────────

router.delete(
  "/:teamId/invites/:inviteId",
  requireRole("owner", "admin"),
  (req: Request, res: Response) => {
    db.prepare("DELETE FROM team_invites WHERE id = ? AND team_id = ?").run(
      req.params.inviteId,
      req.params.teamId
    );
    res.json({ ok: true });
  }
);

// ── Change member role ────────────────────────────────────────

router.patch(
  "/:teamId/members/:userId",
  requireRole("owner"),
  (req: Request, res: Response) => {
    const { role } = req.body as { role?: string };
    if (!role || !["admin", "member", "viewer"].includes(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    if (req.params.userId === req.userId) {
      res.status(400).json({ error: "Cannot change your own role" });
      return;
    }
    const target = db
      .prepare("SELECT role FROM team_members WHERE team_id = ? AND user_id = ?")
      .get(req.params.teamId, req.params.userId) as { role: string } | undefined;
    if (!target) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    if (target.role === "owner") {
      res.status(400).json({ error: "Cannot change the owner's role" });
      return;
    }
    db.prepare(
      "UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?"
    ).run(role, req.params.teamId, req.params.userId);
    res.json({ ok: true });
  }
);

// ── Remove member ─────────────────────────────────────────────

router.delete(
  "/:teamId/members/:userId",
  requireRole("owner", "admin"),
  (req: Request, res: Response) => {
    if (req.params.userId === req.userId) {
      res.status(400).json({ error: "Use the leave endpoint instead" });
      return;
    }
    const target = db
      .prepare("SELECT role FROM team_members WHERE team_id = ? AND user_id = ?")
      .get(req.params.teamId, req.params.userId) as { role: string } | undefined;
    if (!target) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    if (target.role === "owner") {
      res.status(400).json({ error: "Cannot remove the team owner" });
      return;
    }
    db.prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?").run(
      req.params.teamId,
      req.params.userId
    );
    res.json({ ok: true });
  }
);

// ── Leave team ────────────────────────────────────────────────

router.post(
  "/:teamId/leave",
  requireRole("admin", "member", "viewer"),
  (req: Request, res: Response) => {
    db.prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?").run(
      req.params.teamId,
      req.userId!
    );
    res.json({ ok: true });
  }
);

// ── Team collections CRUD + sync ──────────────────────────────

router.get(
  "/:teamId/collections",
  requireRole("owner", "admin", "member", "viewer"),
  (req: Request, res: Response) => {
    const rows = db
      .prepare(
        "SELECT id, data, updated_at, created_at FROM team_collections WHERE team_id = ? ORDER BY created_at ASC"
      )
      .all(req.params.teamId) as { id: string; data: string; updated_at: number; created_at: number }[];

    const collections = rows.map((r) => ({
      id: r.id,
      ...JSON.parse(r.data),
      _syncedAt: r.updated_at,
    }));
    res.json({ collections });
  }
);

router.post(
  "/:teamId/collections",
  requireRole("owner", "admin", "member"),
  (req: Request, res: Response) => {
    const { collection } = req.body as { collection?: Record<string, unknown> & { id?: string } };
    if (!collection) {
      res.status(400).json({ error: "Missing collection" });
      return;
    }
    const id = collection.id || uuid();
    db.prepare(
      `INSERT INTO team_collections (id, team_id, data, updated_by) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_by = excluded.updated_by, updated_at = unixepoch()`
    ).run(id, req.params.teamId, JSON.stringify(collection), req.userId!);
    res.status(201).json({ id, ok: true });
  }
);

router.put(
  "/:teamId/collections/:id",
  requireRole("owner", "admin", "member"),
  (req: Request, res: Response) => {
    const { collection } = req.body as { collection?: Record<string, unknown> };
    if (!collection) {
      res.status(400).json({ error: "Missing collection" });
      return;
    }
    const existing = db
      .prepare("SELECT id FROM team_collections WHERE id = ? AND team_id = ?")
      .get(req.params.id, req.params.teamId);
    if (!existing) {
      res.status(404).json({ error: "Collection not found" });
      return;
    }
    db.prepare(
      "UPDATE team_collections SET data = ?, updated_by = ?, updated_at = unixepoch() WHERE id = ? AND team_id = ?"
    ).run(JSON.stringify(collection), req.userId!, req.params.id, req.params.teamId);
    res.json({ ok: true });
  }
);

router.delete(
  "/:teamId/collections/:id",
  requireRole("owner", "admin"),
  (req: Request, res: Response) => {
    const result = db
      .prepare("DELETE FROM team_collections WHERE id = ? AND team_id = ?")
      .run(req.params.id, req.params.teamId);
    if (result.changes === 0) {
      res.status(404).json({ error: "Collection not found" });
      return;
    }
    res.json({ ok: true });
  }
);

router.post(
  "/:teamId/collections/sync",
  requireRole("owner", "admin", "member"),
  (req: Request, res: Response) => {
    const { collections } = req.body as {
      collections?: Array<Record<string, unknown> & { id: string; _localUpdatedAt?: number }>;
    };
    if (!Array.isArray(collections)) {
      res.status(400).json({ error: "collections must be an array" });
      return;
    }

    const serverRows = db
      .prepare("SELECT id, data, updated_at FROM team_collections WHERE team_id = ?")
      .all(req.params.teamId) as { id: string; data: string; updated_at: number }[];

    const serverMap = new Map(serverRows.map((r) => [r.id, r]));
    const syncTime = Math.floor(Date.now() / 1000);

    const upsert = db.prepare(
      `INSERT INTO team_collections (id, team_id, data, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_by = excluded.updated_by, updated_at = excluded.updated_at`
    );

    const txn = db.transaction(() => {
      for (const col of collections) {
        const serverRow = serverMap.get(col.id);
        if (!serverRow) {
          upsert.run(col.id, req.params.teamId, JSON.stringify(col), req.userId!, syncTime);
        } else {
          const clientModified = col._localUpdatedAt || 0;
          if (clientModified > serverRow.updated_at) {
            upsert.run(col.id, req.params.teamId, JSON.stringify(col), req.userId!, syncTime);
          }
        }
        serverMap.delete(col.id);
      }
    });
    txn();

    const allRows = db
      .prepare("SELECT id, data, updated_at FROM team_collections WHERE team_id = ?")
      .all(req.params.teamId) as { id: string; data: string; updated_at: number }[];

    const merged = allRows.map((r) => ({
      id: r.id,
      ...JSON.parse(r.data),
      _syncedAt: r.updated_at,
    }));

    res.json({ collections: merged, syncedAt: syncTime });
  }
);

// ── Team environments CRUD + sync ─────────────────────────────

router.get(
  "/:teamId/environments",
  requireRole("owner", "admin", "member", "viewer"),
  (req: Request, res: Response) => {
    const rows = db
      .prepare("SELECT id, data, updated_at FROM team_environments WHERE team_id = ? ORDER BY created_at ASC")
      .all(req.params.teamId) as { id: string; data: string; updated_at: number }[];

    const envRows = rows.map((r) => ({
      id: r.id,
      ...JSON.parse(r.data),
      _syncedAt: r.updated_at,
    }));

    const gRow = db
      .prepare("SELECT data FROM team_global_vars WHERE team_id = ?")
      .get(req.params.teamId) as { data: string } | undefined;

    res.json({ environments: envRows, globalVars: gRow ? JSON.parse(gRow.data) : [] });
  }
);

router.post(
  "/:teamId/environments/sync",
  requireRole("owner", "admin", "member"),
  (req: Request, res: Response) => {
    const { environments, globalVars } = req.body as {
      environments?: Array<Record<string, unknown> & { id?: string }>;
      globalVars?: unknown[];
    };

    const syncTime = Math.floor(Date.now() / 1000);

    if (Array.isArray(environments)) {
      const upsert = db.prepare(
        `INSERT INTO team_environments (id, team_id, data, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_by = excluded.updated_by, updated_at = excluded.updated_at`
      );
      const txn = db.transaction(() => {
        for (const env of environments) {
          upsert.run(env.id || uuid(), req.params.teamId, JSON.stringify(env), req.userId!, syncTime);
        }
      });
      txn();
    }

    if (Array.isArray(globalVars)) {
      db.prepare(
        `INSERT INTO team_global_vars (team_id, data, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(team_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      ).run(req.params.teamId, JSON.stringify(globalVars), syncTime);
    }

    const envRows = db
      .prepare("SELECT id, data, updated_at FROM team_environments WHERE team_id = ?")
      .all(req.params.teamId) as { id: string; data: string; updated_at: number }[];

    const gRow = db
      .prepare("SELECT data FROM team_global_vars WHERE team_id = ?")
      .get(req.params.teamId) as { data: string } | undefined;

    res.json({
      environments: envRows.map((r) => ({ id: r.id, ...JSON.parse(r.data), _syncedAt: r.updated_at })),
      globalVars: gRow ? JSON.parse(gRow.data) : [],
      syncedAt: syncTime,
    });
  }
);

export default router;
