import crypto from "crypto";
import { Router, type Request, type Response } from "express";
import { authMiddleware } from "../auth";
import db from "../db";
import {
  ANONYMOUS_USER_ID,
  PUBLIC_API_HOST,
  PUBLIC_API_ORIGIN,
  PUBLIC_APP_ORIGIN,
} from "../config/constants";

const router = Router();

/** Same public doc handler; `id` from `/api/shared/:id`, `idOrSlug` from `/api/share/:slug` */
export const sharedPublicRouter = Router();

type SharedRow = {
  id: string;
  user_id: string;
  collection_id: string;
  slug: string;
  data: string;
  views: number;
  is_public: number;
  created_at: number;
  updated_at: number;
};

function trimTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

function hostNoPort(req: Request): string {
  return (req.get("host") || "").split(":")[0].toLowerCase();
}

/** Public URL of the static web app (doc + import links). */
function webPublicBase(req: Request): string {
  const env =
    process.env.RESTIFY_WEB_URL?.trim() || process.env.RESTFY_WEB_URL?.trim();
  if (env) return trimTrailingSlash(env);
  if (hostNoPort(req) === PUBLIC_API_HOST) {
    return PUBLIC_APP_ORIGIN;
  }
  return `${req.protocol}://${req.get("host")}`;
}

/** Public URL of this API (for apiUrl in share JSON). */
function apiPublicBase(req: Request): string {
  const env =
    process.env.RESTIFY_API_PUBLIC_URL?.trim() ||
    process.env.RESTFY_API_PUBLIC_URL?.trim();
  if (env) return trimTrailingSlash(env);
  if (hostNoPort(req) === PUBLIC_API_HOST) {
    return PUBLIC_API_ORIGIN;
  }
  return `${req.protocol}://${req.get("host")}`;
}

function buildShareResponse(
  req: Request,
  id: string,
  slug: string
): { id: string; slug: string; docUrl: string; importUrl: string; apiUrl: string } {
  const web = webPublicBase(req);
  const api = apiPublicBase(req);
  return {
    id,
    slug,
    docUrl: `${web}/docs/${slug}`,
    importUrl: `${web}/?import=${id}`,
    apiUrl: `${api}/api/shared/${id}`,
  };
}

/** Authenticated: publish from an existing synced collection id + payload */
router.post("/", authMiddleware, (req: Request, res: Response) => {
  const { collectionId, data, slug } = req.body as {
    collectionId?: string;
    data?: Record<string, unknown>;
    slug?: string;
  };
  if (!collectionId || !data) {
    res.status(400).json({ error: "Missing collectionId or data" });
    return;
  }

  const id = crypto.randomBytes(6).toString("hex");
  const uniqueSlug =
    slug ||
    `${String(data.name || "collection")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-${id.slice(0, 4)}`;

  db.prepare(
    `
    INSERT INTO shared_docs (id, user_id, collection_id, slug, data) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, slug = excluded.slug, updated_at = unixepoch()
  `
  ).run(id, req.userId!, collectionId, uniqueSlug, JSON.stringify(data));

  res.status(201).json(buildShareResponse(req, id, uniqueSlug));
});

/**
 * Unauthenticated quick share (web app “Share” without cloud login).
 * Body: `{ collection, name? }`
 */
router.post("/quick", (req: Request, res: Response) => {
  const { collection, name } = req.body as {
    collection?: Record<string, unknown> & { id?: string; name?: string };
    name?: string;
  };
  if (!collection) {
    res.status(400).json({ error: "Missing collection" });
    return;
  }

  const id = crypto.randomBytes(6).toString("hex");
  const payload = { ...collection, name: name || collection.name || "Untitled" };
  const uniqueSlug =
    `${String(payload.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-${id.slice(0, 4)}`;

  const collectionId = typeof collection.id === "string" ? collection.id : id;

  db.prepare(
    `
    INSERT INTO shared_docs (id, user_id, collection_id, slug, data) VALUES (?, ?, ?, ?, ?)
  `
  ).run(id, ANONYMOUS_USER_ID, collectionId, uniqueSlug, JSON.stringify(payload));

  res.status(201).json(buildShareResponse(req, id, uniqueSlug));
});

router.get("/mine", authMiddleware, (req: Request, res: Response) => {
  const rows = db
    .prepare(
      `SELECT id, collection_id, slug, views, is_public, created_at, updated_at
       FROM shared_docs WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(req.userId!) as Omit<SharedRow, "data" | "user_id">[];

  res.json({ docs: rows });
});

router.delete("/:id", authMiddleware, (req: Request, res: Response) => {
  const result = db
    .prepare("DELETE FROM shared_docs WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.userId!);
  if (result.changes === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

export function publicSharedHandler(req: Request, res: Response): void {
  const param =
    (req.params as { id?: string; idOrSlug?: string }).id ??
    (req.params as { id?: string; idOrSlug?: string }).idOrSlug;
  if (!param) {
    res.status(400).json({ error: "Missing id" });
    return;
  }

  let row = db.prepare("SELECT * FROM shared_docs WHERE id = ? OR slug = ?").get(param, param) as
    | SharedRow
    | undefined;

  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!row.is_public) {
    res.status(403).json({ error: "This documentation is private" });
    return;
  }

  db.prepare("UPDATE shared_docs SET views = views + 1 WHERE id = ?").run(row.id);
  row = { ...row, views: row.views + 1 };

  const collection = JSON.parse(row.data) as Record<string, unknown> & { name?: string };
  const owner = db
    .prepare("SELECT name, email FROM users WHERE id = ?")
    .get(row.user_id) as { name: string; email: string } | undefined;

  const topName =
    (typeof collection.name === "string" && collection.name) || "Untitled";

  res.json({
    id: row.id,
    name: topName,
    slug: row.slug,
    collection,
    owner: owner ? { name: owner.name } : null,
    views: row.views,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

router.get("/:idOrSlug", publicSharedHandler);

sharedPublicRouter.get("/:id", publicSharedHandler);

export default router;
