import { geminiService } from "./server/service/gemini.service";
import dotenv from "dotenv";
dotenv.config();

async function testFallback() {
  console.log("=== Bắt đầu thử nghiệm luồng fallback sang Qwen ===");

  // Lưu API Key gốc
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  try {
    // 1. Kiểm tra luồng Gemini Native bình thường (nếu có key)
    console.log("\n--- Bước 1: Thử nghiệm Gemini Native (bình thường) ---");
    if (originalGeminiKey) {
      const response = await geminiService.generate({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: "Hãy trả lời bằng đúng một từ ngắn gọn: 'Gemini'." }] }]
      });
      console.log("Kết quả Gemini Native thành công:", response?.text || JSON.stringify(response));
    } else {
      console.log("Bỏ qua bước 1 do không có GEMINI_API_KEY.");
    }

    // 2. Kiểm tra luồng Fallback sang Qwen khi Gemini lỗi (giả lập bằng cách xóa GEMINI_API_KEY hoặc sửa sai)
    console.log("\n--- Bước 2: Thử nghiệm Fallback sang Qwen (xóa GEMINI_API_KEY) ---");
    // Giả lập lỗi bằng cách xóa key Gemini
    process.env.GEMINI_API_KEY = "AQ.invalid_key_for_testing_fallback_mechanism";
    
    // Gọi generate
    const responseFallback = await geminiService.generate({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: "Hãy trả lời bằng đúng một từ ngắn gọn: 'Qwen'." }] }]
    });

    console.log("Kết quả sau khi Fallback thành công:", responseFallback?.text || JSON.stringify(responseFallback));

  } catch (error: any) {
    console.error("Thử nghiệm thất bại với lỗi:", error);
  } finally {
    // Khôi phục lại key
    process.env.GEMINI_API_KEY = originalGeminiKey;
  }
}

testFallback();
