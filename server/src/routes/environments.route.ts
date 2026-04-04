import { Router, type Request, type Response } from "express";
import { v4 as uuid } from "uuid";
import { authMiddleware } from "../auth";
import db from "../db";

const router = Router();
router.use(authMiddleware);

router.get("/", (req: Request, res: Response) => {
  const rows = db
    .prepare(
      "SELECT id, data, updated_at FROM environments WHERE user_id = ? ORDER BY created_at ASC"
    )
    .all(req.userId!) as { id: string; data: string; updated_at: number }[];

  const environments = rows.map((r) => ({
    id: r.id,
    ...JSON.parse(r.data),
    _syncedAt: r.updated_at,
  }));
  res.json({ environments });
});

router.post("/", (req: Request, res: Response) => {
  const { environment } = req.body as {
    environment?: Record<string, unknown> & { id?: string };
  };
  if (!environment) {
    res.status(400).json({ error: "Missing environment" });
    return;
  }

  const id = environment.id || uuid();
  const data = JSON.stringify(environment);
  db.prepare(
    `
    INSERT INTO environments (id, user_id, data) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = unixepoch()
  `
  ).run(id, req.userId!, data);

  res.status(201).json({ id, ok: true });
});

router.put("/:id", (req: Request, res: Response) => {
  const { environment } = req.body as { environment?: Record<string, unknown> };
  if (!environment) {
    res.status(400).json({ error: "Missing environment" });
    return;
  }

  const existing = db
    .prepare("SELECT id FROM environments WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.userId!);
  if (!existing) {
    res.status(404).json({ error: "Environment not found" });
    return;
  }

  db.prepare(
    "UPDATE environments SET data = ?, updated_at = unixepoch() WHERE id = ? AND user_id = ?"
  ).run(JSON.stringify(environment), req.params.id, req.userId!);
  res.json({ ok: true });
});

router.delete("/:id", (req: Request, res: Response) => {
  const result = db
    .prepare("DELETE FROM environments WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.userId!);
  if (result.changes === 0) {
    res.status(404).json({ error: "Environment not found" });
    return;
  }
  res.json({ ok: true });
});

router.get("/globals", (req: Request, res: Response) => {
  const row = db
    .prepare("SELECT data, updated_at FROM global_vars WHERE user_id = ?")
    .get(req.userId!) as { data: string; updated_at: number } | undefined;
  res.json({
    globalVars: row ? JSON.parse(row.data) : [],
    updatedAt: row ? row.updated_at : 0,
  });
});

router.put("/globals", (req: Request, res: Response) => {
  const { globalVars } = req.body as { globalVars?: unknown[] };
  if (!Array.isArray(globalVars)) {
    res.status(400).json({ error: "globalVars must be an array" });
    return;
  }

  db.prepare(
    `
    INSERT INTO global_vars (user_id, data, updated_at) VALUES (?, ?, unixepoch())
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = unixepoch()
  `
  ).run(req.userId!, JSON.stringify(globalVars));
  res.json({ ok: true });
});

router.post("/sync", (req: Request, res: Response) => {
  const { environments, globalVars } = req.body as {
    environments?: Array<Record<string, unknown> & { id?: string }>;
    globalVars?: unknown[];
  };

  const syncTime = Math.floor(Date.now() / 1000);

  if (Array.isArray(environments)) {
    const upsert = db.prepare(
      `
      INSERT INTO environments (id, user_id, data, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    `
    );
    const txn = db.transaction(() => {
      for (const env of environments) {
        upsert.run(env.id || uuid(), req.userId!, JSON.stringify(env), syncTime);
      }
    });
    txn();
  }

  if (Array.isArray(globalVars)) {
    db.prepare(
      `
      INSERT INTO global_vars (user_id, data, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    `
    ).run(req.userId!, JSON.stringify(globalVars), syncTime);
  }

  const envRows = db
    .prepare("SELECT id, data, updated_at FROM environments WHERE user_id = ?")
    .all(req.userId!) as { id: string; data: string; updated_at: number }[];

  const gRow = db
    .prepare("SELECT data FROM global_vars WHERE user_id = ?")
    .get(req.userId!) as { data: string } | undefined;

  res.json({
    environments: envRows.map((r) => ({
      id: r.id,
      ...JSON.parse(r.data),
      _syncedAt: r.updated_at,
    })),
    globalVars: gRow ? JSON.parse(gRow.data) : [],
    syncedAt: syncTime,
  });
});

export default router;
