import type { Application } from "express";
import authRoutes from "./auth.route";
import collectionsRoutes from "./collections.route";
import environmentsRoutes from "./environments.route";
import shareRoutes, { sharedPublicRouter } from "./share.route";

/**
 * Registers all REST API routers (mvend-erp style: composed from `*.route.ts` modules).
 */
export function registerRestRoutes(app: Application): void {
  app.use("/api/auth", authRoutes);
  app.use("/api/collections", collectionsRoutes);
  app.use("/api/environments", environmentsRoutes);
  app.use("/api/share", shareRoutes);
  app.use("/api/shared", sharedPublicRouter);
}
