import path from "path";
import { config } from "dotenv";

config({ quiet: true });

/** From `server/dist/config` → Restfy app root (`postWoman/`, sibling of `server/`) */
export const APP_ROOT = path.resolve(__dirname, "../../..");

export const PORT = Number(process.env.PORT) || 4000;

export const JWT_SECRET =
  process.env.JWT_SECRET || "restfy-dev-secret-change-in-production";

export const JWT_EXPIRES = "30d" as const;

/** Placeholder user for unauthenticated “quick share” (web client without login) */
export const ANONYMOUS_USER_ID = "__restfy_anonymous__";
