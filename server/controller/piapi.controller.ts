import { Request, Response } from "express";
import Joi from "joi";
import { RenderJobModel } from "../model/render-job.model";
import { cloudinaryService } from "../service/cloudinary.service";
import { emitToUser } from "../socket";

const webhookSchema = Joi.object({
  task_id: Joi.string().required().messages({
    "any.required": "task_id là bắt buộc."
  }),
  status: Joi.string().valid("pending", "processing", "completed", "failed").required().messages({
    "any.only": "Trạng thái không hợp lệ.",
    "any.required": "Trạng thái là bắt buộc."
  }),
  progress: Joi.number().min(0).max(100).optional().messages({
    "number.min": "Tiến trình không hợp lệ.",
    "number.max": "Tiến trình không hợp lệ."
  }),
  output: Joi.object({
    image_urls: Joi.array().items(Joi.string().uri()).optional(),
    image_url: Joi.string().uri().optional(),
    video_url: Joi.string().uri().optional(),
    video: Joi.string().uri().optional(),
    url: Joi.string().uri().optional()
  }).unknown(true).allow(null).optional(),
  error: Joi.string().allow(null, "").optional()
}).unknown(true);

export const piapiController = {
  /**
   * Xử lý webhook cập nhật trạng thái tác vụ gửi từ PiAPI
   */
  async handleWebhook(req: Request, res: Response) {
    const { error } = webhookSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }

    try {
      const { task_id, status, progress, output, error: taskError } = req.body;
      console.log(`[PiAPI Webhook] Received status update for task ${task_id}: ${status}`);

      // Tìm Render Job tương ứng với piapiTaskId
      const job = await RenderJobModel.findOne({ piapiTaskId: task_id });
      if (!job) {
        console.warn(`[PiAPI Webhook] Render job not found for task_id: ${task_id}`);
        // Trả về 200 để tránh PiAPI thử gửi lại liên tục
        res.json({ success: true, message: "Không tìm thấy render job tương ứng." });
        return;
      }

      // Nếu job đã hoàn thành hoặc thất bại trước đó, bỏ qua cập nhật cũ
      if (job.status === "completed" || job.status === "failed") {
        console.log(`[PiAPI Webhook] Job ${job._id} is already in final state: ${job.status}`);
        res.json({ success: true });
        return;
      }

      if (status === "completed" && output) {
        const rawUrl = (output.image_urls && output.image_urls[0]) || output.image_url || output.url || output.video || output.video_url;
        if (!rawUrl) {
          res.status(400).json({ success: false, message: "Không tìm thấy URL kết quả trong output." });
          return;
        }

        console.log(`[PiAPI Webhook] Task ${task_id} completed. Uploading image to Cloudinary...`);
        let finalUrl = rawUrl;
        try {
          finalUrl = await cloudinaryService.uploadMedia(rawUrl, "renders");
          console.log(`[PiAPI Webhook] Uploaded to Cloudinary: ${finalUrl}`);
        } catch (uploadErr) {
          console.error(`[PiAPI Webhook] Cloudinary upload failed for task ${task_id}:`, uploadErr);
        }

        job.status = "completed";
        job.progress = 100;
        job.outputImageUrls = [finalUrl];
        await job.save();

        emitToUser(job.userId.toString(), "renderJobUpdated", job);
        console.log(`[PiAPI Webhook] Job ${job._id} marked as completed.`);
      } else if (status === "failed") {
        console.error(`[PiAPI Webhook] Task ${task_id} failed:`, taskError);
        job.status = "failed";
        job.progress = 100;
        await job.save();

        emitToUser(job.userId.toString(), "renderJobUpdated", job);
        console.log(`[PiAPI Webhook] Job ${job._id} marked as failed.`);
      } else if (status === "processing" && progress !== undefined) {
        const newProgress = Math.max(job.progress || 0, progress);
        if (newProgress !== job.progress) {
          job.progress = newProgress;
          job.status = "processing";
          await job.save();
          emitToUser(job.userId.toString(), "renderJobUpdated", job);
        }
      }

      res.json({ success: true });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Đã có lỗi xảy ra.";
      console.error("[PiAPI Webhook] Internal Error:", err);
      res.status(500).json({ success: false, message: errMsg });
    }
  }
};
