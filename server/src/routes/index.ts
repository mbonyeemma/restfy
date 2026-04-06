import type { Application } from "express";
import authRoutes from "./auth.route";
import collectionsRoutes from "./collections.route";
import environmentsRoutes from "./environments.route";
import shareRoutes, { sharedPublicRouter } from "./share.route";
import teamsRoutes from "./teams.route";
import workspacesRoutes from "./workspaces.route";

export function registerRestRoutes(app: Application): void {
  app.use("/api/auth", authRoutes);
  app.use("/api/collections", collectionsRoutes);
  app.use("/api/environments", environmentsRoutes);
  app.use("/api/share", shareRoutes);
  app.use("/api/shared", sharedPublicRouter);
  app.use("/api/workspaces", workspacesRoutes);
  app.use("/api/teams", teamsRoutes);
}
