import { Router } from "express";
import { geminiController } from "../controller/gemini.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

/**
 * POST /api/v1/gemini/generate - Gửi yêu cầu sinh nội dung tới Gemini/PiAPI
 */
router.post("/generate", authMiddleware, geminiController.generate);

export { router as geminiRouter };
