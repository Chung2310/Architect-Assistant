import { Router } from "express";
import mongoose from "mongoose";
import { authRouter } from "./auth.router";
import { userRouter } from "./user.router";
import { renderJobRouter } from "./render-job.router";
import { mediaRouter } from "./media.router";

const router = Router();

// Version 1 router aggregation
router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/render-jobs", renderJobRouter);
router.use("/media", mediaRouter);

// Health check endpoint
router.get("/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const status = dbStatus === "connected" ? "ok" : "error";
  res.status(status === "ok" ? 200 : 500).json({
    status,
    db: dbStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export { router as apiRouter };
