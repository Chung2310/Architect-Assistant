import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { userService } from "../service/user.service";
import { transactionService } from "../service/transaction.service";
import { renderJobService } from "../service/render-job.service";
import { cloudinaryService } from "../service/cloudinary.service";
import Joi from "joi";

const roleSchema = Joi.object({
  role: Joi.string().valid("user", "admin").required().messages({
    "any.only": "Vai trò không hợp lệ.",
    "any.required": "Vai trò là bắt buộc.",
  }),
});

const creditsSchema = Joi.object({
  amount: Joi.number().required().messages({
    "number.base": "Số lượng credits phải là số.",
    "any.required": "Số lượng credits là bắt buộc.",
  }),
});

const apiKeySchema = Joi.object({
  apiKey: Joi.string().allow("").required(),
});

export const userController = {
  async getList(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(String(req.query.page || "1"), 10);
      const limit = parseInt(String(req.query.limit || "50"), 10);
      const result = await userService.getList(page, limit);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const user = await userService.getById(req.params.id);
      if (!user) {
        res.status(404).json({ success: false, message: "Không tìm thấy tài khoản." });
        return;
      }
      res.json({ success: true, data: user });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateRole(req: AuthRequest, res: Response) {
    const { error } = roleSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const user = await userService.updateRole(req.params.id, req.body.role);
      res.json({ success: true, data: user });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateApiKey(req: AuthRequest, res: Response) {
    const { error } = apiKeySchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      // Chỉ chính user hoặc admin mới được cập nhật API key
      const isMe = req.params.id === "me" || !req.params.id || req.params.id === req.user!.userId;
      const targetId = isMe ? req.user!.userId : req.params.id;
      if (!isMe && req.user!.role !== "admin" && req.user!.role !== "superadmin") {
        res.status(403).json({ success: false, message: "Không có quyền thực hiện hành động này." });
        return;
      }
      const user = await userService.updateApiKey(targetId, req.body.apiKey);
      res.json({ success: true, data: user });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateCredits(req: AuthRequest, res: Response) {
    const { error } = creditsSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const user = await userService.updateCredits(
        req.params.id,
        req.body.amount,
        "topup",
        "Admin Top-up"
      );
      res.json({ success: true, data: user });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async deleteUser(req: AuthRequest, res: Response) {
    try {
      const userId = req.params.id;
      // Xóa render jobs
      await renderJobService.deleteAllByUser(userId);
      // Xóa transactions
      await transactionService.deleteAllByUser(userId);
      // Xóa user
      await userService.deleteUser(userId);
      res.json({ success: true, message: "Đã xóa người dùng và toàn bộ dữ liệu liên quan thành công." });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getTransactions(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(String(req.query.page || "1"), 10);
      const limit = parseInt(String(req.query.limit || "100"), 10);
      const result = await transactionService.getAll(page, limit);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getMyTransactions(req: AuthRequest, res: Response) {
    try {
      const limit = parseInt(String(req.query.limit || "100"), 10);
      const result = await transactionService.getListByUser(req.user!.userId, limit);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
