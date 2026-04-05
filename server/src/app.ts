import express, { type Application, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { PORT } from "./config/constants";
import { registerProxyRoutes } from "./routes/proxy.route";
import { registerRestRoutes } from "./routes/index";

export { PORT };

export function createApp(): Application {
  const app = express();

  registerProxyRoutes(app);

  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.use(express.json({ limit: "50mb" }));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: "Too many attempts, please try again later" },
  });

  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 120,
    message: { error: "Rate limit exceeded" },
  });

  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api", apiLimiter);

  registerRestRoutes(app);

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", version: "1.0.0", time: new Date().toISOString() });
  });

  app.use(
    (err: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error("Server error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  );

  return app;
}
