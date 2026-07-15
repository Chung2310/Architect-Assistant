import { geminiService } from "./server/service/gemini.service";
import dotenv from "dotenv";
dotenv.config();

async function testImageFallback() {
  console.log("=== Bắt đầu thử nghiệm luồng fallback sinh ảnh sang Flux ===");

  // Lưu API Key gốc
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  try {
    // Giả lập lỗi bằng cách đặt key Gemini không hợp lệ
    process.env.GEMINI_API_KEY = "AQ.invalid_key_for_testing_image_fallback";
    
    console.log("Đang yêu cầu sinh ảnh qua Gemini Native Image (sẽ lỗi và chuyển hướng sang Flux)...");
    
    // Gọi generate
    const responseFallback = await geminiService.generate({
      model: "gemini-3.1-flash-image",
      contents: [{ role: "user", parts: [{ text: "A small red apple on a wooden table, simple background" }] }],
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    const hasGeneratedImages = responseFallback?.generatedImages?.length > 0;
    const hasCandidates = responseFallback?.candidates?.length > 0;

    console.log("Kết quả sau khi Fallback:");
    console.log("- Có generatedImages:", hasGeneratedImages);
    console.log("- Có candidates:", hasCandidates);

    if (hasGeneratedImages) {
      const img = responseFallback.generatedImages[0].image;
      console.log(`- MimeType: ${img.mimeType}`);
      console.log(`- Base64 Length: ${img.imageBytes.length}`);
      console.log("- 50 ký tự base64 đầu tiên:", img.imageBytes.substring(0, 50));
    }

  } catch (error: any) {
    console.error("Thử nghiệm sinh ảnh thất bại với lỗi:", error);
  } finally {
    // Khôi phục lại key
    process.env.GEMINI_API_KEY = originalGeminiKey;
  }
}

testImageFallback();
