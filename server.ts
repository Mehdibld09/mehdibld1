import path from "node:path";
import fs from "node:fs";
import express from "express";
import { createServer as createViteServer } from "vite";
import app from "./artifacts/api-server/src/app";
import { logger } from "./artifacts/api-server/src/lib/logger";

const PORT = 3000;

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0" },
      appType: "spa",
      configFile: path.resolve(process.cwd(), "artifacts/steamshare/vite.config.ts"),
      root: path.resolve(process.cwd(), "artifacts/steamshare"),
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "artifacts/steamshare/dist");
    const distPublicPath = path.resolve(process.cwd(), "artifacts/steamshare/dist/public");
    const staticDir = fs.existsSync(distPublicPath) ? distPublicPath : distPath;
    app.use(express.static(staticDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    logger.info({ port: PORT }, `Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
