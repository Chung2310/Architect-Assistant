import { geminiService } from "../server/service/gemini.service";
import dotenv from "dotenv";
dotenv.config();

async function testJsonFallback() {
  console.log("=== Bắt đầu thử nghiệm luồng JSON fallback sang Qwen 3.6 Flash ===");

  const originalGeminiKey = process.env.GEMINI_API_KEY;

  try {
    // Xóa API Key của Gemini để ép hệ thống chuyển hướng fallback sang Qwen
    process.env.GEMINI_API_KEY = "AQ.invalid_key_for_testing_json_fallback";

    // Gọi generate với yêu cầu định dạng JSON nhưng prompt KHÔNG có chữ 'json'
    const response = await geminiService.generate({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: "Trả về danh sách 3 loài hoa đẹp bằng tiếng Việt. Mỗi loài hoa gồm tên và màu sắc." }] }],
      config: {
        responseMimeType: "application/json"
      }
    });

    console.log("Kết quả JSON từ Qwen 3.6 Flash thành công:");
    console.log(response?.text || JSON.stringify(response));

  } catch (error: any) {
    console.error("Thử nghiệm thất bại với lỗi:", error);
  } finally {
    process.env.GEMINI_API_KEY = originalGeminiKey;
  }
}

testJsonFallback();
