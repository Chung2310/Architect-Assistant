import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { logger } from "../utils/logger";

export function loggerMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, originalUrl, ip } = req;
  
  // Clone body to avoid side-effects and sanitize sensitive fields
  const bodyCopy = req.body ? { ...req.body } : {};
  if (bodyCopy.password) {
    bodyCopy.password = "[HIDDEN]";
  }
  if (bodyCopy.file && typeof bodyCopy.file === "string") {
    bodyCopy.file = `[BASE64 DATA: ${bodyCopy.file.length} chars]`;
  }

  logger.info(`[REQUEST] ${method} ${originalUrl} - IP: ${ip}`);
  if (Object.keys(bodyCopy).length > 0) {
    logger.info(`[REQUEST-BODY] ${JSON.stringify(bodyCopy)}`);
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const userId = req.user?.userId || "Guest";
    logger.info(`[RESPONSE] ${method} ${originalUrl} - Status: ${statusCode} - User: ${userId} - Duration: ${duration}ms`);
  });

  next();
}
