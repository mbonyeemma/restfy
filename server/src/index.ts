import { config } from "dotenv";
import type { Server } from "http";
import { createApp, PORT } from "./app";

config();

let server: Server | null = null;

const start = (): void => {
  try {
    const app = createApp();
    server = app.listen(PORT, () => {
      console.log(`\n  Restify server — http://localhost:${PORT}`);
      console.log(`  API            — http://localhost:${PORT}/api`);
      console.log(`  Health check   — http://localhost:${PORT}/api/health\n`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

const gracefulShutdown = (signal: string): void => {
  console.log(`\nReceived ${signal}, shutting down...`);
  if (server) {
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  } else {
    process.exit(0);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

if (require.main === module) {
  start();
}
