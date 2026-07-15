import express from "express";
import path from "path";
import { createServer } from "http";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import dotenv from "dotenv";
import { loggerMiddleware } from "./server/middleware/logger.middleware";
import { logger } from "./server/utils/logger";

// Load environment variables
dotenv.config();

import { connectDB } from "./server/config/database";
import { apiRouter } from "./server/router/index";
import { swaggerDocument } from "./server/swagger/index";
import { initSocket } from "./server/socket";
import { pollingService } from "./server/service/polling.service";

async function startServer() {
  // Connect to database
  await connectDB();

  // Initialize background polling for PiAPI
  pollingService.init();

  const app = express();
  app.use(loggerMiddleware);

  const server = createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Initialize Socket.io
  initSocket(server);

  // Common middlewares
  app.use(cookieParser());
  
  // CORS middleware utilizing allowedOrigins from environment
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = (process.env.LINK_COR || "").split(",").map(o => o.trim());
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-User-Api-Key,x-user-api-key");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Body parser before routing
  app.use(express.json({ limit: '50mb' }));
  
  // Swagger Documentation
  app.use("/api-docs", swaggerUi.serve as unknown as express.RequestHandler, swaggerUi.setup(swaggerDocument) as unknown as express.RequestHandler);

  // Versioned API routes
  app.use("/api/v1", apiRouter);

  // Legacy health check for backwards compatibility
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Gemini proxy removed. Now using versioned server-side SDK endpoint (/api/v1/gemini/generate).

  // Proxy route to bypass CORS for images
  app.get("/api/proxy-image", async (req, res) => {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).send("Missing url parameter");
      return;
    }
    try {
      const fetchRes = await fetch(url);
      if (!fetchRes.ok) {
        // Just return the status code without logging as a server error
        res.status(fetchRes.status).send(`HTTP ${fetchRes.status}`);
        return;
      }
      const buffer = await fetchRes.arrayBuffer();
      res.setHeader("Content-Type", fetchRes.headers.get("content-type") || "application/octet-stream");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(Buffer.from(buffer));
    } catch (e) {
      // Only log actual network/parsing errors, not HTTP status errors
      res.status(500).send(String(e));
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global unhandled error handler middleware
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error(`[UNHANDLED ERROR] ${req.method} ${req.originalUrl}: ${err}`);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Đã có lỗi hệ thống xảy ra." });
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`Swagger documentation available at http://localhost:${PORT}/api-docs`);
  });
}

startServer();
