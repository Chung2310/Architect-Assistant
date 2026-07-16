import dotenv from "dotenv";

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

console.log(`[OpenRouter Service] Loaded API Key status: ${OPENROUTER_API_KEY ? `Present (Length: ${OPENROUTER_API_KEY.length}, Prefix: ${OPENROUTER_API_KEY.substring(0, 8)}...)` : "Missing"}`);

// nano-banana 2 trên OpenRouter
const NANO_BANANA_2_MODEL = "google/gemini-3-pro-image-preview";

export const openrouterService = {
  /**
   * Sinh ảnh đồng bộ bằng OpenRouter (chat completion trả ảnh trực tiếp trong response,
   * không có task_id để poll như PiAPI).
   */
  async generateImage(
    prompt: string,
    _model: string,
    options?: { aspectRatio?: string; image?: string }
  ): Promise<{ url: string; isMock: boolean }> {
    if (!OPENROUTER_API_KEY) {
      console.log(`[OpenRouter Image Generation] Running in MOCK mode (No OPENROUTER_API_KEY).`);
      const seed = Math.floor(Math.random() * 1000000);
      return { url: `https://picsum.photos/seed/${seed}/1024/1024`, isMock: true };
    }

    const content: Record<string, unknown>[] = [{ type: "text", text: prompt }];
    if (options?.image) {
      content.push({ type: "image_url", image_url: { url: options.image } });
    }

    const reqBody = {
      model: NANO_BANANA_2_MODEL,
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    };

    try {
      console.log(`[OpenRouter Image Generation] Requesting image. Body:`, JSON.stringify(reqBody, null, 2));
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify(reqBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter request failed: ${response.status} - ${errorText}`);
      }

      const json = (await response.json()) as {
        choices?: {
          message?: {
            images?: { image_url?: { url?: string } }[];
            content?: string;
          };
        }[];
      };
      console.log(`[OpenRouter Image Generation] Response:`, JSON.stringify(json, null, 2));

      const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!url) {
        throw new Error("Không nhận được ảnh từ OpenRouter. Kiểm tra lại định dạng response.");
      }

      return { url, isMock: false };
    } catch (error) {
      console.error("[OpenRouter Image Generation] Error:", error);
      throw error;
    }
  },
};
