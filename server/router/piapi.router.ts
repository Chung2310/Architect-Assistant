import { Router } from "express";
import { piapiController } from "../controller/piapi.controller";

const router = Router();

/**
 * POST /api/v1/piapi/webhook - Nhận callback từ PiAPI khi có cập nhật task
 */
router.post("/webhook", piapiController.handleWebhook);

export { router as piapiRouter };
