import type { Application, Request, Response } from "express";

function collectRawBody(req: Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const SKIP_HEADERS = new Set([
  "host",
  "origin",
  "referer",
  "connection",
  "accept-encoding",
  "content-length",
]);

/**
 * CORS proxy for the web client — must be registered **before** `express.json()`.
 */
export function registerProxyRoutes(app: Application): void {
  app.options("/api/proxy", (_req: Request, res: Response) => {
    res.set({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    });
    res.sendStatus(204);
  });

  app.all("/api/proxy", async (req: Request, res: Response) => {
    const targetUrl = req.query.url;
    if (typeof targetUrl !== "string" || !targetUrl) {
      res.status(400).json({ error: "Missing url query parameter" });
      return;
    }

    try {
      const rawBody = await collectRawBody(req);

      const fwdHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (v === undefined) continue;
        if (SKIP_HEADERS.has(k.toLowerCase())) continue;
        fwdHeaders[k] = Array.isArray(v) ? v.join(", ") : v;
      }

      const fetchOpts: RequestInit = {
        method: req.method,
        headers: fwdHeaders,
        redirect: "follow",
      };
      if (rawBody.length > 0 && req.method !== "GET" && req.method !== "HEAD") {
        fetchOpts.body = new Uint8Array(rawBody);
      }

      const upstream = await fetch(targetUrl, fetchOpts);
      const respBuf = Buffer.from(await upstream.arrayBuffer());

      const skip = new Set([
        "transfer-encoding",
        "content-encoding",
        "content-security-policy",
        "content-length",
      ]);
      upstream.headers.forEach((v, k) => {
        if (!skip.has(k.toLowerCase())) res.set(k, v);
      });
      res.set("Content-Length", String(respBuf.length));
      res.status(upstream.status).send(respBuf);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Proxy error";
      res.status(502).json({ error: message });
    }
  });
}
