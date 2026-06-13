import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { renderJobService } from "../service/render-job.service";
import { userService } from "../service/user.service";
import { piapiService } from "../service/piapi.service";
import { emitToUser } from "../socket";
import Joi from "joi";
import { logger } from "../utils/logger";

const createJobSchema = Joi.object({
  type: Joi.string().required().messages({ "any.required": "Loại render là bắt buộc." }),
  subType: Joi.string().allow("").optional(),
  inputImageUrls: Joi.array().items(Joi.string().uri()).optional(),
  referenceImageUrls: Joi.array().items(Joi.string().uri()).optional(),
  prompt: Joi.string().allow("").optional(),
  model: Joi.string().allow("").optional(),
  resolution: Joi.string().valid("1K", "2K", "4K").optional(),
});

const idParamSchema = Joi.object({
  id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    "string.pattern.base": "ID không đúng định dạng MongoDB ObjectId.",
    "any.required": "ID là bắt buộc.",
  }),
});

const limitQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).optional().messages({
    "number.base": "Giới hạn phải là số.",
    "number.integer": "Giới hạn phải là số nguyên.",
    "number.min": "Giới hạn tối thiểu là 1.",
  }),
});

const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional().messages({
    "number.base": "Trang phải là số.",
    "number.integer": "Trang phải là số nguyên.",
    "number.min": "Trang tối thiểu là 1.",
  }),
  limit: Joi.number().integer().min(1).optional().messages({
    "number.base": "Giới hạn phải là số.",
    "number.integer": "Giới hạn phải là số nguyên.",
    "number.min": "Giới hạn tối thiểu là 1.",
  }),
});

const updateJobSchema = Joi.object({
  status: Joi.string().valid("pending", "processing", "completed", "failed").required().messages({
    "any.only": "Trạng thái không hợp lệ.",
    "any.required": "Trạng thái là bắt buộc.",
  }),
  outputImageUrls: Joi.array().items(Joi.string().uri()).optional(),
  progress: Joi.number().min(0).max(100).optional().messages({
    "number.min": "Tiến trình không được nhỏ hơn 0.",
    "number.max": "Tiến trình không được lớn hơn 100.",
  }),
});

export const renderJobController = {
  async getMyJobs(req: AuthRequest, res: Response) {
    const { error } = limitQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const limit = parseInt(String(req.query.limit || "50"), 10);
      const jobs = await renderJobService.getListByUser(req.user!.userId, limit);
      logger.info(`[renderJobController.getMyJobs] Retrieved ${jobs.length} jobs for user: ${req.user!.userId}`);
      res.json({ success: true, data: jobs });
    } catch (error) {
      logger.error(`[renderJobController.getMyJobs] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async getAllJobs(req: AuthRequest, res: Response) {
    const { error } = paginationQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const page = parseInt(String(req.query.page || "1"), 10);
      const limit = parseInt(String(req.query.limit || "100"), 10);
      const result = await renderJobService.getAll(page, limit);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error(`[renderJobController.getAllJobs] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async createJob(req: AuthRequest, res: Response) {
    const { error } = createJobSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      // Kiểm tra credits trước khi tạo job
      const credits = await userService.getCredits(req.user!.userId);
      if (credits <= 0) {
        res.status(402).json({ success: false, message: "Bạn đã hết Credits. Vui lòng nạp thêm để tiếp tục." });
        return;
      }

      // Kiểm tra xem đây có phải là model của PiAPI không, tự động map model cũ/Gemini sang piapi-flux
      const { model, prompt, inputImageUrls, aspectRatio } = req.body;
      
      let piapiModel = model || "piapi-flux";
      if (!piapiModel.startsWith("piapi-") && piapiModel !== "nano-banana-pro" && piapiModel !== "nano-banana-2") {
        piapiModel = "piapi-flux";
      }

      let piapiTaskId = "";
      let status = "pending";
      let progress = 0;

      let parsedPrompt = prompt || "";
      try {
        const parsed = JSON.parse(prompt);
        parsedPrompt = parsed.prompt_tieng_viet_toi_uu || parsed.optimized_english_prompt || prompt;
      } catch {
        // Không phải chuỗi JSON
      }

      // Tích hợp link ảnh gốc vào prompt đối với Midjourney
      let finalPrompt = parsedPrompt;
      if (inputImageUrls && inputImageUrls.length > 0) {
        finalPrompt = inputImageUrls.join(" ") + " " + finalPrompt;
      }

      const aspect = aspectRatio || "1:1";

      try {
        logger.info(`[renderJobController] Creating PiAPI task for model: ${piapiModel}`);
        const taskResult = await piapiService.createImageTask(finalPrompt, piapiModel, { aspectRatio: aspect });
        piapiTaskId = taskResult.taskId;
        status = "processing";
        progress = 10;
      } catch (apiErr) {
        logger.error(`[renderJobController] Failed to create PiAPI task: ${apiErr}`);
        res.status(500).json({ success: false, message: "Không thể khởi tạo tác vụ trên PiAPI: " + (apiErr as Error).message });
        return;
      }

      const job = await renderJobService.create({
        userId: req.user!.userId,
        ...req.body,
        model: piapiModel,
        status,
        progress,
        piapiTaskId,
      });

      logger.info(`[renderJobController.createJob] Job created successfully: ${job._id} | Model: ${piapiModel} | User: ${req.user!.userId}`);
      emitToUser(req.user!.userId, "renderJobUpdated", job);
      res.status(201).json({ success: true, data: job });
    } catch (error) {
      logger.error(`[renderJobController.createJob] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async updateJob(req: AuthRequest, res: Response) {
    const paramValidation = idParamSchema.validate(req.params);
    if (paramValidation.error) {
      res.status(400).json({ success: false, message: paramValidation.error.details[0].message });
      return;
    }
    const { error } = updateJobSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const { status, outputImageUrls, progress } = req.body;
      const job = await renderJobService.updateStatus(req.params.id, status, outputImageUrls, progress);
      if (!job) {
        res.status(404).json({ success: false, message: "Không tìm thấy render job." });
        return;
      }
      logger.info(`[renderJobController.updateJob] Job updated successfully: ${job._id} | Status: ${status} | Progress: ${progress}%`);
      emitToUser(job.userId.toString(), "renderJobUpdated", job);
      res.json({ success: true, data: job });
    } catch (error) {
      logger.error(`[renderJobController.updateJob] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async deleteJob(req: AuthRequest, res: Response) {
    const { error } = idParamSchema.validate(req.params);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const job = await renderJobService.deleteJob(req.params.id);
      if (!job) {
        res.status(404).json({ success: false, message: "Không tìm thấy render job." });
        return;
      }
      logger.info(`[renderJobController.deleteJob] Job deleted successfully: ${req.params.id}`);
      res.json({ success: true, message: "Đã xóa render job." });
    } catch (error) {
      logger.error(`[renderJobController.deleteJob] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async deductCredits(req: AuthRequest, res: Response) {
    try {
      const { cost, type, model } = req.body;
      if (typeof cost !== "number" || cost <= 0) {
        res.status(400).json({ success: false, message: "Số credits không hợp lệ." });
        return;
      }
      const remainingCredits = await userService.deductCredits(
        req.user!.userId,
        cost,
        type || "text",
        model || "unknown"
      );
      logger.log("info", `[renderJobController.deductCredits] Deducted ${cost} credits for user: ${req.user!.userId}. Remaining: ${remainingCredits}`);
      res.json({ success: true, data: { remainingCredits } });
    } catch (error) {
      logger.error(`[renderJobController.deductCredits] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      const statusCode = errMsg.includes("hết Credits") ? 402 : 500;
      res.status(statusCode).json({ success: false, message: errMsg });
    }
  },
};
