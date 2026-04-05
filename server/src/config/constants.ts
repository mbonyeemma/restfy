import { config } from "dotenv";

config({ quiet: true });

export const PORT = Number(process.env.PORT) || 4000;

/** Production split: static / Electron web UI (docs + import links) */
export const PUBLIC_APP_ORIGIN = "https://app.restify.online";

/** Production split: API (share payloads, CORS target) */
export const PUBLIC_API_ORIGIN = "https://api.restify.online";

/** Request Host header (no port) when API is served at api.restify.online */
export const PUBLIC_API_HOST = "api.restify.online";

export const JWT_SECRET =
  process.env.JWT_SECRET || "restify-dev-secret-change-in-production";

export const JWT_EXPIRES = "30d" as const;

/** Placeholder user for unauthenticated “quick share” (web client without login) */
export const ANONYMOUS_USER_ID = "__restfy_anonymous__";

/** HttpOnly cookie name for cross-subdomain session (promo + app on *.restify.online) */
export const AUTH_COOKIE_NAME = "restify_auth";

/**
 * Set in production (e.g. `.restify.online`) so login also sets a cookie the marketing site can use.
 * Leave unset on localhost — API uses Bearer tokens only.
 */
export const AUTH_COOKIE_DOMAIN = process.env.RESTIFY_AUTH_COOKIE_DOMAIN?.trim() || "";
