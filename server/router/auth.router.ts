import { Router } from "express";
import { authController } from "../controller/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

/**
 * POST /api/v1/auth/login
 * POST /api/v1/auth/register
 * POST /api/v1/auth/refresh-token
 * GET  /api/v1/auth/me
 * POST /api/v1/auth/logout
 */
router.post("/login", authController.login);
router.post("/register", authController.register);
router.post("/refresh-token", authController.refreshToken);
router.get("/me", authMiddleware, authController.getMe);
router.post("/logout", authController.logout);

export { router as authRouter };
