import { Request, Response } from "express";
import Joi from "joi";
import { geminiService } from "../service/gemini.service";
import { resolvePromptTemplate } from "../service/prompt-template.service";
import { logger } from "../utils/logger";

const generateSchema = Joi.object({
  params: Joi.object({
    model: Joi.string().required().messages({
      "any.required": "Tên model là bắt buộc.",
      "string.base": "Tên model phải là chuỗi ký tự.",
    }),
    contents: Joi.any().optional(),
    config: Joi.object().optional(),
    generationConfig: Joi.object().optional(),
    systemInstruction: Joi.any().optional(),
    promptTemplateKey: Joi.string().optional(),
    promptTemplateInput: Joi.object().optional(),
  }).required(),
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
      if (!params.contents && !params.promptTemplateKey) {
        res.status(400).json({
          success: false,
          message: "Cần cung cấp `contents` hoặc `promptTemplateKey`.",
        });
        return;
      }

      let finalParams = params;
      if (params.promptTemplateKey) {
        const resolved = resolvePromptTemplate(
          params.promptTemplateKey,
          params.promptTemplateInput || {},
        );
        finalParams = {
          ...params,
          ...resolved,
        };
      }

      const userApiKey =
        (req.headers["x-user-api-key"] as string) ||
        (req.headers["X-User-Api-Key"] as string) ||
        (req.body.userApiKey as string) ||
        "";

      logger.info(
        `[Gemini Controller] Handling generate request for model: ${finalParams?.model}, hasUserKey: ${!!userApiKey}, template: ${params?.promptTemplateKey || "none"}`
      );

      const response = await geminiService.generate(finalParams, userApiKey);

      res.status(200).json({
        success: true,
        data: response,
      });
    } catch (err: unknown) {
      const errorObj = err as {
        status?: number;
        message?: string;
      };
      logger.error(`[Gemini Controller] Error: ${errorObj.message}`);

      const statusCode = errorObj.status || 500;
      let errMsg = errorObj.message || "Lỗi xử lý yêu cầu AI.";

      if (statusCode === 403) {
        errMsg = "Dự án Google Cloud của bạn bị từ chối truy cập API Gemini.";
      } else if (statusCode === 400) {
        errMsg = "Tham số yêu cầu không hợp lệ hoặc bị từ chối bởi quy tắc an toàn.";
      } else if (statusCode === 429) {
        errMsg = "Yêu cầu vượt quá giới hạn tần suất của API Key.";
      } else if (statusCode === 503) {
        errMsg = "Dịch vụ AI của Gemini hiện đang quá tải hoặc tạm thời không khả dụng.";
      }

      res.status(statusCode).json({
        success: false,
        message: errMsg,
        details: errorObj.message,
      });
    }
  },
};
