import crypto from "crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import { v4 as uuid } from "uuid";
import { authMiddleware } from "../auth";
import db from "../db";
import { sendWorkspaceInviteEmail } from "../lib/email";

const router = Router();
router.use(authMiddleware);

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: number;
  updated_at: number;
};

type WorkspaceInviteRow = {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  invited_by: string;
  token: string;
  expires_at: number;
  accepted_at: number | null;
  created_at: number;
};

function getWorkspaceMemberRole(workspaceId: string, userId: string): string | null {
  const row = db
    .prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
    .get(workspaceId, userId) as { role: string } | undefined;
  return row?.role ?? null;
}

function requireWorkspaceRole(
  ...allowed: string[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const workspaceId = req.params.workspaceId;
    const role = getWorkspaceMemberRole(workspaceId, req.userId!);
    if (!role) {
      res.status(403).json({ error: "You are not a member of this workspace" });
      return;
    }
    if (!allowed.includes(role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    (req as { workspaceRole?: string }).workspaceRole = role;
    next();
  };
}

// ── Accept invite (before /:workspaceId) ───────────────────────

router.post("/accept-invite", (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: "Invite token is required" });
    return;
  }

  const invite = db
    .prepare(
      "SELECT * FROM workspace_invites WHERE token = ? AND accepted_at IS NULL AND expires_at > unixepoch()"
    )
    .get(token) as WorkspaceInviteRow | undefined;
  if (!invite) {
    res.status(400).json({ error: "Invalid or expired invitation" });
    return;
  }

  const alreadyMember = db
    .prepare("SELECT user_id FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
    .get(invite.workspace_id, req.userId!) as { user_id: string } | undefined;
  if (alreadyMember) {
    db.prepare("UPDATE workspace_invites SET accepted_at = unixepoch() WHERE id = ?").run(invite.id);
    res.json({ ok: true, workspaceId: invite.workspace_id, alreadyMember: true });
    return;
  }

  db.prepare(
    "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)"
  ).run(invite.workspace_id, req.userId!, invite.role);

  db.prepare("UPDATE workspace_invites SET accepted_at = unixepoch() WHERE id = ?").run(invite.id);

  const ws = db
    .prepare("SELECT id, name, slug FROM workspaces WHERE id = ?")
    .get(invite.workspace_id) as WorkspaceRow;
  res.json({
    ok: true,
    workspace: { id: ws.id, name: ws.name, slug: ws.slug },
    role: invite.role,
  });
});

// ── Create workspace ──────────────────────────────────────────

router.post("/", (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: "Workspace name is required" });
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

  db.prepare("INSERT INTO workspaces (id, name, slug, created_by) VALUES (?, ?, ?, ?)").run(
    id,
    name.trim(),
    slug,
    req.userId!
  );

  db.prepare(
    "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')"
  ).run(id, req.userId!);

  res.status(201).json({ id, name: name.trim(), slug, role: "owner" });
});

// ── List my workspaces ──────────────────────────────────────

router.get("/", (req: Request, res: Response) => {
  const rows = db
    .prepare(
      `SELECT w.id, w.name, w.slug, w.created_at, wm.role,
              (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id) AS member_count
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
       ORDER BY w.name COLLATE NOCASE`
    )
    .all(req.userId!) as (WorkspaceRow & { role: string; member_count: number })[];

  res.json({ workspaces: rows });
});

// ── Get workspace details ─────────────────────────────────────

router.get(
  "/:workspaceId",
  requireWorkspaceRole("owner", "admin", "member", "viewer"),
  (req: Request, res: Response) => {
    const ws = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(req.params.workspaceId) as
      | WorkspaceRow
      | undefined;
    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const members = db
      .prepare(
        `SELECT wm.user_id, wm.role, wm.joined_at, u.email, u.name
         FROM workspace_members wm
         JOIN users u ON u.id = wm.user_id
         WHERE wm.workspace_id = ?
         ORDER BY wm.joined_at ASC`
      )
      .all(ws.id) as {
      user_id: string;
      role: string;
      joined_at: number;
      email: string;
      name: string;
    }[];

    const pendingInvites = db
      .prepare(
        "SELECT id, email, role, created_at FROM workspace_invites WHERE workspace_id = ? AND accepted_at IS NULL AND expires_at > unixepoch()"
      )
      .all(ws.id) as { id: string; email: string; role: string; created_at: number }[];

    const teams = db
      .prepare(
        `SELECT id, name, slug, created_at,
                (SELECT COUNT(*) FROM team_members WHERE team_id = teams.id) AS member_count
         FROM teams WHERE workspace_id = ? ORDER BY name COLLATE NOCASE`
      )
      .all(ws.id) as { id: string; name: string; slug: string; created_at: number; member_count: number }[];

    res.json({
      workspace: ws,
      members,
      pendingInvites,
      teams,
      myRole: (req as { workspaceRole?: string }).workspaceRole,
    });
  }
);

// ── Update workspace ──────────────────────────────────────────

router.patch(
  "/:workspaceId",
  requireWorkspaceRole("owner", "admin"),
  (req: Request, res: Response) => {
    const { name } = req.body as { name?: string };
    if (name !== undefined) {
      db.prepare("UPDATE workspaces SET name = ?, updated_at = unixepoch() WHERE id = ?").run(
        name.trim(),
        req.params.workspaceId
      );
    }
    const ws = db
      .prepare("SELECT * FROM workspaces WHERE id = ?")
      .get(req.params.workspaceId) as WorkspaceRow;
    res.json({ workspace: ws });
  }
);

// ── Delete workspace ─────────────────────────────────────────

router.delete(
  "/:workspaceId",
  requireWorkspaceRole("owner"),
  (req: Request, res: Response) => {
    db.prepare("DELETE FROM workspaces WHERE id = ?").run(req.params.workspaceId);
    res.json({ ok: true });
  }
);

// ── Invite to workspace ───────────────────────────────────────

router.post(
  "/:workspaceId/invite",
  requireWorkspaceRole("owner", "admin"),
  (req: Request, res: Response) => {
    const { email, role } = req.body as { email?: string; role?: string };
    if (!email?.trim()) {
      res.status(400).json({ error: "Email is required" });
      return;
    }
    const inviteRole = role && ["admin", "member", "viewer"].includes(role) ? role : "member";

    const existing = db
      .prepare(
        `SELECT wm.user_id FROM workspace_members wm
         JOIN users u ON u.id = wm.user_id
         WHERE wm.workspace_id = ? AND u.email = ?`
      )
      .get(req.params.workspaceId, email.trim().toLowerCase()) as { user_id: string } | undefined;
    if (existing) {
      res.status(409).json({ error: "This user is already a workspace member" });
      return;
    }

    const pendingDupe = db
      .prepare(
        "SELECT id FROM workspace_invites WHERE workspace_id = ? AND email = ? AND accepted_at IS NULL AND expires_at > unixepoch()"
      )
      .get(req.params.workspaceId, email.trim().toLowerCase()) as { id: string } | undefined;
    if (pendingDupe) {
      res.status(409).json({ error: "An invitation is already pending for this email" });
      return;
    }

    const id = uuid();
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

    db.prepare(
      "INSERT INTO workspace_invites (id, workspace_id, email, role, invited_by, token, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      id,
      req.params.workspaceId,
      email.trim().toLowerCase(),
      inviteRole,
      req.userId!,
      token,
      expiresAt
    );

    const inviter = db
      .prepare("SELECT name, email FROM users WHERE id = ?")
      .get(req.userId!) as { name: string; email: string };
    const ws = db.prepare("SELECT name FROM workspaces WHERE id = ?").get(req.params.workspaceId) as {
      name: string;
    };

    void sendWorkspaceInviteEmail(
      email.trim(),
      inviter.name || inviter.email,
      ws.name,
      token,
      inviteRole
    ).catch((err) => console.error("[email] workspace invite:", err));

    res.status(201).json({ ok: true, inviteId: id });
  }
);

// ── Cancel workspace invite ───────────────────────────────────

router.delete(
  "/:workspaceId/invites/:inviteId",
  requireWorkspaceRole("owner", "admin"),
  (req: Request, res: Response) => {
    db.prepare("DELETE FROM workspace_invites WHERE id = ? AND workspace_id = ?").run(
      req.params.inviteId,
      req.params.workspaceId
    );
    res.json({ ok: true });
  }
);

// ── Change workspace member role ──────────────────────────────

router.patch(
  "/:workspaceId/members/:userId",
  requireWorkspaceRole("owner"),
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
      .prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
      .get(req.params.workspaceId, req.params.userId) as { role: string } | undefined;
    if (!target) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    if (target.role === "owner") {
      res.status(400).json({ error: "Cannot change the owner's role" });
      return;
    }
    db.prepare(
      "UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?"
    ).run(role, req.params.workspaceId, req.params.userId);
    res.json({ ok: true });
  }
);

// ── Remove workspace member ───────────────────────────────────

router.delete(
  "/:workspaceId/members/:userId",
  requireWorkspaceRole("owner", "admin"),
  (req: Request, res: Response) => {
    if (req.params.userId === req.userId) {
      res.status(400).json({ error: "Use the leave endpoint instead" });
      return;
    }
    const target = db
      .prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
      .get(req.params.workspaceId, req.params.userId) as { role: string } | undefined;
    if (!target) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    if (target.role === "owner") {
      res.status(400).json({ error: "Cannot remove the workspace owner" });
      return;
    }
    db.prepare("DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?").run(
      req.params.workspaceId,
      req.params.userId
    );
    res.json({ ok: true });
  }
);

// ── Leave workspace ───────────────────────────────────────────

router.post(
  "/:workspaceId/leave",
  requireWorkspaceRole("admin", "member", "viewer"),
  (req: Request, res: Response) => {
    db.prepare("DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?").run(
      req.params.workspaceId,
      req.userId!
    );
    res.json({ ok: true });
  }
);

export default router;
