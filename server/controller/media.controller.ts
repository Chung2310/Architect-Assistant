import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { cloudinaryService } from "../service/cloudinary.service";
import Joi from "joi";

const uploadSchema = Joi.object({
  file: Joi.string().required().messages({ "any.required": "Dữ liệu file là bắt buộc." }),
  folder: Joi.string().allow("").optional(),
});

const deleteMediaSchema = Joi.object({
  publicId: Joi.string().required().messages({
    "any.required": "publicId là bắt buộc.",
  }),
});

export const mediaController = {
  async upload(req: AuthRequest, res: Response) {
    const { error } = uploadSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const { file, folder } = req.body;
      const folderPath = folder || `igen_architect/${req.user!.userId}`;
      const url = await cloudinaryService.uploadMedia(file, folderPath);
      res.json({ success: true, data: { url, secure_url: url } });
    } catch (error) {
      console.error("[mediaController] Upload error:", error);
      const errMsg = error instanceof Error ? error.message : "Tải lên thất bại.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async deleteMedia(req: AuthRequest, res: Response) {
    const { error } = deleteMediaSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      let { publicId } = req.body;
      if (publicId && (publicId.startsWith("http://") || publicId.startsWith("https://"))) {
        const extracted = cloudinaryService.extractPublicId(publicId);
        if (extracted) {
          publicId = extracted;
        }
      }
      await cloudinaryService.deleteMedia(publicId);
      res.json({ success: true, message: "Đã xóa media thành công." });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },
};
