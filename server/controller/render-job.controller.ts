import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { renderJobService } from "../service/render-job.service";
import { userService } from "../service/user.service";
import { emitToUser } from "../socket";
import Joi from "joi";

const createJobSchema = Joi.object({
  type: Joi.string().required().messages({ "any.required": "Loại render là bắt buộc." }),
  subType: Joi.string().allow("").optional(),
  inputImageUrls: Joi.array().items(Joi.string().uri()).optional(),
  referenceImageUrls: Joi.array().items(Joi.string().uri()).optional(),
  prompt: Joi.string().allow("").optional(),
  model: Joi.string().allow("").optional(),
  resolution: Joi.string().valid("1K", "2K", "4K").optional(),
});

export const renderJobController = {
  async getMyJobs(req: AuthRequest, res: Response) {
    try {
      const limit = parseInt(String(req.query.limit || "50"), 10);
      const jobs = await renderJobService.getListByUser(req.user!.userId, limit);
      res.json({ success: true, data: jobs });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getAllJobs(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(String(req.query.page || "1"), 10);
      const limit = parseInt(String(req.query.limit || "100"), 10);
      const result = await renderJobService.getAll(page, limit);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
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

      const job = await renderJobService.create({
        userId: req.user!.userId,
        ...req.body,
      });
      emitToUser(req.user!.userId, "renderJobUpdated", job);
      res.status(201).json({ success: true, data: job });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateJob(req: AuthRequest, res: Response) {
    try {
      const { status, outputImageUrls, progress } = req.body;
      const job = await renderJobService.updateStatus(req.params.id, status, outputImageUrls, progress);
      if (!job) {
        res.status(404).json({ success: false, message: "Không tìm thấy render job." });
        return;
      }
      emitToUser(job.userId.toString(), "renderJobUpdated", job);
      res.json({ success: true, data: job });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async deleteJob(req: AuthRequest, res: Response) {
    try {
      const job = await renderJobService.deleteJob(req.params.id);
      if (!job) {
        res.status(404).json({ success: false, message: "Không tìm thấy render job." });
        return;
      }
      res.json({ success: true, message: "Đã xóa render job." });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
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
      res.json({ success: true, data: { remainingCredits } });
    } catch (error: any) {
      const statusCode = error.message.includes("hết Credits") ? 402 : 500;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  },
};
