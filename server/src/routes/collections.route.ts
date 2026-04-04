import { Router, type Request, type Response } from "express";
import { v4 as uuid } from "uuid";
import { authMiddleware } from "../auth";
import db from "../db";

const router = Router();
router.use(authMiddleware);

router.get("/", (req: Request, res: Response) => {
  const rows = db
    .prepare(
      "SELECT id, data, updated_at, created_at FROM collections WHERE user_id = ? ORDER BY created_at ASC"
    )
    .all(req.userId!) as { id: string; data: string; updated_at: number; created_at: number }[];

  const collections = rows.map((r) => ({
    id: r.id,
    ...JSON.parse(r.data),
    _syncedAt: r.updated_at,
  }));
  res.json({ collections });
});

router.post("/", (req: Request, res: Response) => {
  const { collection } = req.body as { collection?: Record<string, unknown> & { id?: string } };
  if (!collection) {
    res.status(400).json({ error: "Missing collection" });
    return;
  }

  const id = collection.id || uuid();
  const data = JSON.stringify(collection);
  db.prepare(
    `
    INSERT INTO collections (id, user_id, data) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = unixepoch()
  `
  ).run(id, req.userId!, data);

  res.status(201).json({ id, ok: true });
});

router.put("/:id", (req: Request, res: Response) => {
  const { collection } = req.body as { collection?: Record<string, unknown> };
  if (!collection) {
    res.status(400).json({ error: "Missing collection" });
    return;
  }

  const existing = db
    .prepare("SELECT id FROM collections WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.userId!);
  if (!existing) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  const data = JSON.stringify(collection);
  db.prepare(
    "UPDATE collections SET data = ?, updated_at = unixepoch() WHERE id = ? AND user_id = ?"
  ).run(data, req.params.id, req.userId!);
  res.json({ ok: true });
});

router.delete("/:id", (req: Request, res: Response) => {
  const result = db
    .prepare("DELETE FROM collections WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.userId!);
  if (result.changes === 0) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }
  res.json({ ok: true });
});

router.post("/sync", (req: Request, res: Response) => {
  const { collections } = req.body as {
    collections?: Array<Record<string, unknown> & { id: string; _localUpdatedAt?: number }>;
  };
  if (!Array.isArray(collections)) {
    res.status(400).json({ error: "collections must be an array" });
    return;
  }

  const serverRows = db
    .prepare("SELECT id, data, updated_at FROM collections WHERE user_id = ?")
    .all(req.userId!) as { id: string; data: string; updated_at: number }[];

  const serverMap = new Map(serverRows.map((r) => [r.id, r]));

  const syncTime = Math.floor(Date.now() / 1000);

  const upsert = db.prepare(
    `
    INSERT INTO collections (id, user_id, data, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `
  );

  const clientNew: string[] = [];

  const txn = db.transaction(() => {
    for (const col of collections) {
      const serverRow = serverMap.get(col.id);
      if (!serverRow) {
        upsert.run(col.id, req.userId!, JSON.stringify(col), syncTime);
        clientNew.push(col.id);
      } else {
        const clientModified = col._localUpdatedAt || 0;
        if (clientModified > serverRow.updated_at) {
          upsert.run(col.id, req.userId!, JSON.stringify(col), syncTime);
          clientNew.push(col.id);
        }
      }
      serverMap.delete(col.id);
    }
  });
  txn();

  const allRows = db
    .prepare("SELECT id, data, updated_at FROM collections WHERE user_id = ?")
    .all(req.userId!) as { id: string; data: string; updated_at: number }[];

  const merged = allRows.map((r) => ({
    id: r.id,
    ...JSON.parse(r.data),
    _syncedAt: r.updated_at,
  }));

  res.json({ collections: merged, syncedAt: syncTime });
});

export default router;
