import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { userService } from "../service/user.service";
import { transactionService } from "../service/transaction.service";
import { renderJobService } from "../service/render-job.service";
import Joi from "joi";
import { logger } from "../utils/logger";

const roleSchema = Joi.object({
  role: Joi.string().valid("user", "admin", "superadmin").required().messages({
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

const idParamSchema = Joi.object({
  id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    "string.pattern.base": "ID không đúng định dạng MongoDB ObjectId.",
    "any.required": "ID là bắt buộc.",
  }),
});

const apiKeyParamSchema = Joi.object({
  id: Joi.alternatives().try(
    Joi.string().valid("me"),
    Joi.string().regex(/^[0-9a-fA-F]{24}$/)
  ).optional(),
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

export const userController = {
  async getList(req: AuthRequest, res: Response) {
    const { error } = paginationQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const page = parseInt(String(req.query.page || "1"), 10);
      const limit = parseInt(String(req.query.limit || "50"), 10);
      const result = await userService.getList(page, limit);
      logger.info(`[userController.getList] Admin listed users. Page: ${page}, Limit: ${limit}`);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error(`[userController.getList] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    const { error } = idParamSchema.validate(req.params);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const user = await userService.getById(req.params.id);
      if (!user) {
        res.status(404).json({ success: false, message: "Không tìm thấy tài khoản." });
        return;
      }
      logger.info(`[userController.getById] Retrieved user: ${req.params.id}`);
      res.json({ success: true, data: user });
    } catch (error) {
      logger.error(`[userController.getById] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async updateRole(req: AuthRequest, res: Response) {
    const paramValidation = idParamSchema.validate(req.params);
    if (paramValidation.error) {
      res.status(400).json({ success: false, message: paramValidation.error.details[0].message });
      return;
    }
    const { error } = roleSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const user = await userService.updateRole(req.params.id, req.body.role);
      logger.info(`[userController.updateRole] Updated role for user: ${req.params.id} to: ${req.body.role}`);
      res.json({ success: true, data: user });
    } catch (error) {
      logger.error(`[userController.updateRole] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async updateApiKey(req: AuthRequest, res: Response) {
    const paramValidation = apiKeyParamSchema.validate(req.params);
    if (paramValidation.error) {
      res.status(400).json({ success: false, message: paramValidation.error.details[0].message });
      return;
    }
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
      logger.info(`[userController.updateApiKey] Updated API key for user: ${targetId}`);
      res.json({ success: true, data: user });
    } catch (error) {
      logger.error(`[userController.updateApiKey] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async updateCredits(req: AuthRequest, res: Response) {
    const paramValidation = idParamSchema.validate(req.params);
    if (paramValidation.error) {
      res.status(400).json({ success: false, message: paramValidation.error.details[0].message });
      return;
    }
    const { error } = creditsSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const amount = req.body.amount;
      const type = amount < 0 ? "deduct" : "topup";
      const user = await userService.updateCredits(
        req.params.id,
        Math.abs(amount),
        type,
        "Admin Top-up"
      );
      logger.info(`[userController.updateCredits] Updated credits for user: ${req.params.id} by: ${amount}`);
      res.json({ success: true, data: user });
    } catch (error) {
      logger.error(`[userController.updateCredits] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async deleteUser(req: AuthRequest, res: Response) {
    const { error } = idParamSchema.validate(req.params);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const userId = req.params.id;
      // Xóa render jobs
      await renderJobService.deleteAllByUser(userId);
      // Xóa transactions
      await transactionService.deleteAllByUser(userId);
      // Xóa user
      await userService.deleteUser(userId);
      logger.info(`[userController.deleteUser] Deleted user: ${userId} and all related data.`);
      res.json({ success: true, message: "Đã xóa người dùng và toàn bộ dữ liệu liên quan thành công." });
    } catch (error) {
      logger.error(`[userController.deleteUser] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async getTransactions(req: AuthRequest, res: Response) {
    const { error } = paginationQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const page = parseInt(String(req.query.page || "1"), 10);
      const limit = parseInt(String(req.query.limit || "100"), 10);
      const result = await transactionService.getAll(page, limit);
      logger.info(`[userController.getTransactions] Admin listed transactions. Page: ${page}, Limit: ${limit}`);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error(`[userController.getTransactions] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async getMyTransactions(req: AuthRequest, res: Response) {
    const limitQuerySchema = Joi.object({
      limit: Joi.number().integer().min(1).optional().messages({
        "number.base": "Giới hạn phải là số.",
        "number.integer": "Giới hạn phải số nguyên.",
        "number.min": "Giới hạn tối thiểu là 1.",
      }),
    });
    const { error } = limitQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const limit = parseInt(String(req.query.limit || "100"), 10);
      const result = await transactionService.getListByUser(req.user!.userId, limit);
      logger.info(`[userController.getMyTransactions] User ${req.user!.userId} retrieved transactions. Limit: ${limit}`);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error(`[userController.getMyTransactions] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },
};
