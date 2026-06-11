import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { cloudinaryService } from "../service/cloudinary.service";
import Joi from "joi";

const uploadSchema = Joi.object({
  file: Joi.string().required().messages({ "any.required": "Dữ liệu file là bắt buộc." }),
  folder: Joi.string().allow("").optional(),
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
      res.json({ success: true, data: { url } });
    } catch (error: any) {
      console.error("[mediaController] Upload error:", error);
      res.status(500).json({ success: false, message: error.message || "Tải lên thất bại." });
    }
  },

  async deleteMedia(req: AuthRequest, res: Response) {
    try {
      const { publicId } = req.body;
      if (!publicId) {
        res.status(400).json({ success: false, message: "publicId là bắt buộc." });
        return;
      }
      await cloudinaryService.deleteMedia(publicId);
      res.json({ success: true, message: "Đã xóa media thành công." });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
