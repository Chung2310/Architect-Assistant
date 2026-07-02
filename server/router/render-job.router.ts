import { Router } from "express";
import { renderJobController } from "../controller/render-job.controller";
import { authMiddleware, adminMiddleware } from "../middleware/auth.middleware";

const router = Router();

/**
 * GET    /api/v1/render-jobs         - Lấy render jobs của user hiện tại
 * GET    /api/v1/render-jobs/all     - [Admin] Lấy tất cả render jobs
 * POST   /api/v1/render-jobs         - Tạo render job mới
 * PATCH  /api/v1/render-jobs/:id     - Cập nhật status/output của job
 * DELETE /api/v1/render-jobs/:id     - Xóa job
 * POST   /api/v1/render-jobs/deduct-credits - Trừ credits sau khi render
 */
router.post("/deduct-credits", authMiddleware, renderJobController.deductCredits);
router.get("/all", authMiddleware, adminMiddleware, renderJobController.getAllJobs);
router.get("/", authMiddleware, renderJobController.getMyJobs);
router.get("/:id", authMiddleware, renderJobController.getJobById);
router.post("/", authMiddleware, renderJobController.createJob);
router.patch("/:id", authMiddleware, renderJobController.updateJob);
router.delete("/:id", authMiddleware, renderJobController.deleteJob);

export { router as renderJobRouter };
