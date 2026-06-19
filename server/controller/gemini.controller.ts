import { Request, Response } from "express";
import { geminiService } from "../service/gemini.service";
import Joi from "joi";
import { logger } from "../utils/logger";

const generateSchema = Joi.object({
  params: Joi.object({
    model: Joi.string().required().messages({
      "any.required": "Tên model là bắt buộc.",
      "string.base": "Tên model phải là chuỗi ký tự."
    }),
    contents: Joi.any().required().messages({
      "any.required": "Dữ liệu contents là bắt buộc."
    }),
    config: Joi.object().optional(),
    generationConfig: Joi.object().optional(),
    systemInstruction: Joi.any().optional(),
  }).required().messages({
    "any.required": "Tham số params là bắt buộc."
  })
});

export const geminiController = {
  async generate(req: Request, res: Response) {
    const { error } = generateSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }

    try {
      const { params } = req.body;
      // Lấy userApiKey từ header hoặc body
      const userApiKey = (req.headers['x-user-api-key'] as string)
        || (req.headers['X-User-Api-Key'] as string)
        || (req.body.userApiKey as string)
        || "";

      logger.info(`[Gemini Controller] Handling generate request for model: ${params?.model}, hasUserKey: ${!!userApiKey}`);
      
      const response = await geminiService.generate(params, userApiKey);
      
      return res.status(200).json({
        success: true,
        data: response
      });
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string; statusText?: string };
      logger.error(`[Gemini Controller] Error: ${error.message}`);
      
      const statusCode = error.status || 500;
      let errMsg = error.message || "Lỗi xử lý yêu cầu AI.";

      if (statusCode === 403) {
        errMsg = "Dự án Google Cloud của bạn bị từ chối truy cập API Gemini. Vui lòng kiểm tra lại API Key hoặc liên hệ hỗ trợ.";
      } else if (statusCode === 400) {
        errMsg = "Tham số yêu cầu không hợp lệ hoặc bị từ chối bởi quy tắc an toàn của Google AI.";
      } else if (statusCode === 429) {
        errMsg = "Yêu cầu vượt quá giới hạn tần suất (Rate Limit) của API Key. Vui lòng thử lại sau.";
      } else if (statusCode === 503) {
        errMsg = "Dịch vụ AI của Gemini hiện đang quá tải hoặc tạm thời không khả dụng. Vui lòng thử lại sau.";
      }

      return res.status(statusCode).json({
        success: false,
        message: errMsg,
        details: error.message
      });
    }
  }
};
