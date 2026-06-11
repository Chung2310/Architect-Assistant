import { Router } from "express";
import { mediaController } from "../controller/media.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

/**
 * POST   /api/v1/media/upload   - Upload file lên Cloudinary
 * DELETE /api/v1/media          - Xóa file khỏi Cloudinary
 */
router.post("/upload", authMiddleware, mediaController.upload);
router.delete("/", authMiddleware, mediaController.deleteMedia);

export { router as mediaRouter };
