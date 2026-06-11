import { v2 as cloudinary } from "cloudinary";

let isConfigured = false;

function ensureConfigured() {
  if (isConfigured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  isConfigured = true;
}

export const cloudinaryService = {
  /**
   * Upload file (Base64 hoặc URL công khai) lên Cloudinary
   */
  async uploadMedia(fileStr: string, folder: string): Promise<string> {
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new Error("Cấu hình Cloudinary chưa đầy đủ trong biến môi trường.");
    }
    ensureConfigured();
    try {
      const response = await cloudinary.uploader.upload(fileStr, {
        folder: folder || "igen_architect",
        resource_type: "auto",
      });
      return response.secure_url;
    } catch (error: any) {
      console.error("[cloudinaryService] Lỗi upload:", error);
      throw new Error(`Tải lên Cloudinary thất bại: ${error.message || error}`);
    }
  },

  /**
   * Xóa file theo public_id từ Cloudinary
   */
  async deleteMedia(publicId: string): Promise<void> {
    ensureConfigured();
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error: any) {
      console.error("[cloudinaryService] Lỗi xóa media:", error);
    }
  },

  /**
   * Lấy public_id từ Cloudinary URL
   */
  extractPublicId(url: string): string | null {
    try {
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z]+)?$/i);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  },
};
