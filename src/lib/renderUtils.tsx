import { GoogleGenAI } from "@google/genai";
import { apiClient, ApiResponse } from "../services/apiClient";
import { toast } from "sonner";

export const globalImageCache: Record<string, string> = {};

export const getAIClient = async (modelName: string) => {
  // @ts-expect-error: window.aistudio is injected in AIStudio environment
  const isAIStudio = typeof window !== "undefined" && window.aistudio;

  let userApiKey = "";
  try {
    const res = await apiClient.get<ApiResponse<{ apiKey?: string }>>("/api/v1/auth/me");
    if (res.success && res.data?.apiKey) {
      userApiKey = res.data.apiKey;
    }
  } catch (e) {
    console.error("Error fetching user API key:", e);
  }

  if (isAIStudio) {
    if (
      modelName === "gemini-3.1-flash-image-preview" ||
      modelName === "gemini-3-pro-image-preview" ||
      modelName === "gemini-2.5-flash" ||
      modelName === "veo-3.1-generate-preview" ||
      modelName === "veo-3.1-lite-generate-preview"
    ) {
      // @ts-expect-error: window.aistudio is injected in AIStudio environment
      if (!(await window.aistudio.hasSelectedApiKey())) {
        // @ts-expect-error: window.aistudio is injected in AIStudio environment
        await window.aistudio.openSelectKey();
      }
    }
    return new GoogleGenAI({
      apiKey:
        userApiKey ||
        process.env.API_KEY ||
        process.env.GEMINI_API_KEY,
    });
  } else {
    // In published app, use our backend proxy to securely inject the API key at runtime
    const baseUrl = window.location.origin + "/api/gemini-proxy";
    return new GoogleGenAI({
      apiKey: userApiKey || "dummy", // The backend proxy will overwrite this with the real key if 'dummy'
      httpOptions: {
        baseUrl,
        headers: userApiKey ? { "x-user-api-key": userApiKey } : undefined,
      },
    });
  }
};

export const safeJsonParse = (text: string | null | undefined): Record<string, unknown> | unknown[] | null => {
  if (!text) return null;

  // Clean up potential markdown blocks first
  const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();

  // Try direct parse first
  try {
    return JSON.parse(cleanedText) as Record<string, unknown> | unknown[];
  } catch {
    // If direct parse fails, try to extract JSON block
    try {
      const firstOpen = Math.min(
        cleanedText.indexOf("{") === -1 ? Infinity : cleanedText.indexOf("{"),
        cleanedText.indexOf("[") === -1 ? Infinity : cleanedText.indexOf("["),
      );
      const lastClose = Math.max(
        cleanedText.lastIndexOf("}"),
        cleanedText.lastIndexOf("]"),
      );

      if (firstOpen !== Infinity && lastClose !== -1 && lastClose > firstOpen) {
        const jsonStr = cleanedText.substring(firstOpen, lastClose + 1);
        return JSON.parse(jsonStr) as Record<string, unknown> | unknown[];
      }
    } catch {
      // Ignore
    }
    return {};
  }
};

export const checkUserCredits = async (): Promise<boolean> => {
  try {
    const res = await apiClient.get<ApiResponse<{ credits?: number }>>("/api/v1/auth/me");
    if (res.success && res.data) {
      const credits = parseFloat(String(res.data.credits || 0));
      if (credits <= 0) {
        window.dispatchEvent(new CustomEvent("show-topup-modal"));
        toast.error("Bạn đã hết Credits. Vui lòng nạp thêm để tiếp tục.");
        return false;
      }
      return true;
    }
  } catch (error) {
    console.error("Error checking credits:", error);
  }
  return false;
};

// Helper to upload media file via REST API
export const uploadMedia = async (file: File | Blob, folder = "igen-architect"): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const res = await apiClient.post<ApiResponse<{ secure_url?: string }>>("/api/v1/media/upload", {
          file: base64,
          folder: folder
        });
        if (res.success && res.data?.secure_url) {
          resolve(res.data.secure_url);
        } else {
          reject(new Error(res.message || "Tải ảnh lên thất bại. Vui lòng thử lại."));
        }
      } catch (err: unknown) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Lỗi khi đọc file."));
    reader.readAsDataURL(file);
  });
};

interface AIResponse {
  response?: {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: {
            data: string;
            mimeType: string;
          };
        }>;
      };
    }>;
    generatedImages?: Array<{
      image?: {
        imageBytes?: string;
      };
      imageBytes?: string;
    }>;
    promptFeedback?: {
      blockReason?: string;
      safetyRatings?: Array<{
        blocked?: boolean;
      }>;
    };
    text?: string | (() => string);
  };
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          data: string;
          mimeType: string;
        };
      }>;
    };
  }>;
  generatedImages?: Array<{
    image?: {
      imageBytes?: string;
    };
    imageBytes?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
    safetyRatings?: Array<{
      blocked?: boolean;
    }>;
  };
  text?: string | (() => string);
}

export const generateContentWithRetry = async (
  ai: GoogleGenAI,
  params: Record<string, unknown>,
  retries = 8,
  delay = 2000,
  timeoutMs = 180000,
) => {
  try {
    const res = await apiClient.get<ApiResponse<{ credits?: number }>>("/api/v1/auth/me");
    if (res.success && res.data) {
      const credits = parseFloat(String(res.data.credits || 0));
      if (credits <= 0) {
        window.dispatchEvent(new CustomEvent("show-topup-modal"));
        throw new Error("Bạn đã hết Credits. Vui lòng nạp thêm.");
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Bạn đã hết Credits. Vui lòng nạp thêm.")
      throw error;
    console.error("Error checking credits:", error);
  }

  let timeoutRetries = 0;
  for (let i = 0; i < retries; i++) {
    let timeoutId: NodeJS.Timeout;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs);
      });

      let result: AIResponse | null = null;
      const modelName = (params.model as string) || "";
      const isNanoBanana =
        modelName.includes("image") && !modelName.startsWith("imagen-");

      // Normalize parameters for the SDK
      const {
        model,
        contents,
        systemInstruction,
        generationConfig,
        config,
        ...rest
      } = params;
      const combinedConfig = {
        ...((config as Record<string, unknown>) || {}),
        ...((generationConfig as Record<string, unknown>) || {}),
        ...(rest || {}),
      };

      const callParams = {
        model,
        contents,
        config: combinedConfig,
      } as Record<string, unknown>;

      if (systemInstruction && !combinedConfig.systemInstruction) {
        combinedConfig.systemInstruction = systemInstruction;
      }

      // Handle nano-banana specific constraints
      if (isNanoBanana) {
        delete combinedConfig.responseMimeType;
        delete combinedConfig.responseSchema;

        if (combinedConfig.systemInstruction) {
          const sysInstr = String(combinedConfig.systemInstruction);
          delete combinedConfig.systemInstruction;

          if (Array.isArray(callParams.contents)) {
            const firstUserContent =
              (callParams.contents as Array<{ role?: string; parts?: unknown[] }>).find((c) => c.role === "user") ||
              callParams.contents[0];
            if (firstUserContent) {
              if (!firstUserContent.parts) firstUserContent.parts = [];
              firstUserContent.parts.unshift({
                text: "SYSTEM INSTRUCTION: " + sysInstr + "\n\n",
              });
            }
          } else if (callParams.contents && typeof callParams.contents === "object" && "parts" in callParams.contents) {
            const contentsObj = callParams.contents as { parts?: unknown[] };
            if (!contentsObj.parts) contentsObj.parts = [];
            contentsObj.parts.unshift({
              text: "SYSTEM INSTRUCTION: " + sysInstr + "\n\n",
            });
          } else if (typeof callParams.contents === "string") {
            callParams.contents = `SYSTEM INSTRUCTION: ${sysInstr}\n\n${callParams.contents}`;
          }
        }
      }

      if (modelName.startsWith("imagen-")) {
        let prompt = "";
        if (Array.isArray(callParams.contents)) {
          const allParts = callParams.contents.flatMap(
            (c: { parts?: unknown[] }) => c.parts || [],
          );
          const promptPart = (allParts as Array<{ text?: string }>).find((p) => p?.text);
          prompt = promptPart ? (promptPart.text as string) : "";
        } else if (callParams.contents && typeof callParams.contents === "object" && "parts" in callParams.contents) {
          const contentsObj = callParams.contents as { parts?: Array<{ text?: string }> };
          const promptPart = contentsObj.parts?.find((p) => p.text);
          prompt = promptPart ? (promptPart.text as string) : "";
        } else {
          prompt =
            typeof callParams.contents === "string" ? callParams.contents : "";
        }

        const imageConfig = (callParams.config as { imageConfig?: { aspectRatio?: string; imageSize?: string } })?.imageConfig || {};

        const backendRes = await apiClient.post<ApiResponse<AIResponse>>("/api/v1/gemini/generate", {
          params: {
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
              imageConfig: {
                aspectRatio: imageConfig.aspectRatio || "1:1",
                imageSize: imageConfig.imageSize || "1K"
              }
            }
          }
        });

        if (!backendRes || !backendRes.success) {
          throw new Error(backendRes?.message || "Lỗi sinh ảnh từ server.");
        }
        const imageResponse = backendRes.data;

        const base64Data =
          imageResponse.generatedImages?.[0]?.image?.imageBytes;
        if (!base64Data) {
          throw new Error("Không nhận được dữ liệu ảnh từ Imagen API.");
        }
        result = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      data: base64Data,
                      mimeType: "image/png",
                    },
                  },
                ],
              },
            },
          ],
          text: "",
        };
      } else {
        const backendRes = await apiClient.post<ApiResponse<AIResponse>>("/api/v1/gemini/generate", {
          params: callParams
        });

        if (!backendRes || !backendRes.success) {
          throw new Error(backendRes?.message || "Lỗi kết nối API Gemini.");
        }
        const fullResult = backendRes.data;

        const rawResponse = fullResult?.response || fullResult;
        let candidates = rawResponse?.candidates || [];

        if (candidates.length === 0 && rawResponse?.generatedImages) {
          candidates = rawResponse.generatedImages.map((img) => ({
            content: {
              parts: [
                {
                  inlineData: {
                    data: img.image?.imageBytes || img.imageBytes || "",
                    mimeType: "image/png",
                  },
                },
              ],
            },
          }));
        }

        result = {
          ...rawResponse,
          candidates: candidates,
          text: "",
          promptFeedback: rawResponse?.promptFeedback,
        };
        try {
          if (typeof rawResponse?.text === "function") {
            result.text = rawResponse.text();
          } else if (typeof rawResponse?.text === "string") {
            result.text = rawResponse.text;
          } else if (candidates && candidates[0]?.content?.parts) {
            result.text = candidates[0].content.parts
              .map((part: { text?: string }) => part.text || "")
              .join("");
          } else {
            result.text = "";
          }
        } catch {
          result.text = "";
        }

        const promptBlocked =
          result.promptFeedback?.blockReason ||
          (result.promptFeedback?.safetyRatings?.some(
            (r: { blocked?: boolean }) => r.blocked === true,
          )
            ? "SAFETY"
            : null);

        if (
          result.candidates.length === 0 &&
          !promptBlocked &&
          i < retries - 1
        ) {
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }

      clearTimeout(timeoutId!);

      try {
        let cost = 0;
        const modelName = (params.model as string) || "";

        if (modelName.includes("image")) {
          const resolution =
            (params.generationConfig as { imageConfig?: { imageSize?: string } })?.imageConfig?.imageSize ||
            (params.config as { imageConfig?: { imageSize?: string } })?.imageConfig?.imageSize ||
            "1K";
          if (modelName === "gemini-3.1-flash-image-preview") {
            cost = resolution === "2K" ? 42 : 27.5;
          } else if (modelName === "gemini-3-pro-image-preview") {
            cost = 57;
          } else {
            cost = 27.5;
          }
        } else if (modelName.includes("veo")) {
          cost = 0.5;
        } else {
          if (
            modelName === "gemini-3.1-pro-preview" ||
            modelName.includes("pro")
          ) {
            cost = 10;
          } else if (
            modelName === "gemini-3-flash-preview" ||
            modelName.includes("flash")
          ) {
            cost = 2.5;
          } else {
            cost = 2.5;
          }
        }

        if (cost > 0) {
          let type = "text";
          if (modelName.includes("image")) type = "image";
          else if (modelName.includes("veo")) type = "video";
          else if (modelName.includes("audio")) type = "audio";

          // Deduct credits via REST API
          await apiClient.post("/api/v1/render-jobs/deduct-credits", {
            cost,
            type,
            model: modelName,
          });
        }
      } catch (costError) {
        console.error("Error deducting credits:", costError);
      }

      return result;
    } catch (error: unknown) {
      clearTimeout(timeoutId!);
      const errorStr =
        typeof error === "string"
          ? error
          : (error as Error)?.message || JSON.stringify(error);
      const isTimeout = errorStr.includes("TIMEOUT");
      const isQuotaExceeded =
        errorStr.includes("exceeded its monthly spending cap") ||
        ((error as { status?: number })?.status === 429 &&
          !errorStr.includes("requests per minute") &&
          errorStr.includes("spend"));
      const isRetryable =
        !isQuotaExceeded &&
        (errorStr.includes("503") ||
          errorStr.includes("UNAVAILABLE") ||
          (error as { status?: number })?.status === 503 ||
          errorStr.includes("high demand") ||
          errorStr.includes("429") ||
          errorStr.includes("RESOURCE_EXHAUSTED") ||
          (error as { status?: number })?.status === 429 ||
          isTimeout ||
          errorStr.includes("fetch failed") ||
          errorStr.includes("overloaded") ||
          errorStr.includes("internal error"));

      if (isQuotaExceeded) {
        throw new Error(
          "Bạn đã hết hạn mức chi phí trên Google AI Studio. Vui lòng tăng giới hạn (Set spend cap) tại ai.studio/spend, sau đó chờ 10-15 phút để hệ thống cập nhật.",
          { cause: error }
        );
      }

      if (isTimeout) {
        timeoutRetries++;
        if (timeoutRetries > 5) {
          throw new Error(
            "Kết nối mạng không ổn định hoặc máy chủ phản hồi quá lâu. Vui lòng thử lại.",
            { cause: error }
          );
        }
      }

      if (isRetryable) {
        if (i < retries - 1) {
          if (
            i === 1 &&
            params.model &&
            ((params.model as string) === "gemini-3.1-pro-preview" ||
              (params.model as string).includes("pro") ||
              (params.model as string) === "gemini-2.5-flash")
          ) {
            params.model = "gemini-2.5-flash";
          }
          await new Promise((res) => setTimeout(res, delay));
          delay = Math.min(delay * 1.5, 10000);
        } else {
          throw new Error(
            "Hệ thống AI đang quá tải hoặc không phản hồi. Vui lòng thử lại sau ít phút.",
            { cause: error }
          );
        }
      } else {
        if (errorStr.includes("403") || (error as { status?: number })?.status === 403) {
          throw new Error(
            "Lỗi 403: API Key không có quyền truy cập model này hoặc Imagen 3 chưa được kích hoạt. Vui lòng kiểm tra lại API Key.",
            { cause: error }
          );
        }
        throw error;
      }
    }
  }
};

export const generateContentStreamWithRetry = async function* (
  ai: GoogleGenAI,
  params: Record<string, unknown>,
  retries = 8,
  delay = 2000,
  timeoutMs = 180000,
) {
  try {
    const res = await apiClient.get<ApiResponse<{ credits?: number }>>("/api/v1/auth/me");
    if (res.success && res.data) {
      const credits = parseFloat(String(res.data.credits || 0));
      if (credits <= 0) {
        window.dispatchEvent(new CustomEvent("show-topup-modal"));
        throw new Error("Bạn đã hết Credits. Vui lòng nạp thêm.");
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Bạn đã hết Credits. Vui lòng nạp thêm.")
      throw error;
    console.error("Error checking credits:", error);
  }

  let timeoutRetries = 0;
  for (let i = 0; i < retries; i++) {
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      const stream = await ai.models.generateContentStream(params as unknown as Parameters<typeof ai.models.generateContentStream>[0]);
      const iterator = stream[Symbol.asyncIterator]();

      let lastChunk: unknown = null;
      try {
        while (true) {
          const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error("TIMEOUT")),
              timeoutMs,
            );
          });

          const nextPromise = iterator.next();
          const result = (await Promise.race([
            nextPromise,
            timeoutPromise,
          ])) as IteratorResult<unknown>;

          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }

          if (result.done) {
            break;
          }
          lastChunk = result.value;
          yield result.value;
        }
      } catch (iterError: unknown) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (iterator.return) {
          try {
            await iterator.return(undefined);
          } catch {
            // Ignore
          }
        }
        throw iterError;
      }

      if (lastChunk) {
        try {
          let cost = 0;
          const modelName = (params.model as string) || "";

          if (modelName.includes("image")) {
            const resolution =
              (params.generationConfig as { imageConfig?: { imageSize?: string } })?.imageConfig?.imageSize ||
              (params.config as { imageConfig?: { imageSize?: string } })?.imageConfig?.imageSize ||
              "1K";
            if (modelName === "gemini-3.1-flash-image-preview") {
              cost = resolution === "2K" ? 42 : 27.5;
            } else if (modelName === "gemini-3-pro-image-preview") {
              cost = 57;
            } else {
              cost = 27.5;
            }
          } else if (modelName.includes("veo")) {
            cost = 0.5;
          } else {
            if (
              modelName === "gemini-3.1-pro-preview" ||
              modelName.includes("pro")
            ) {
              cost = 10;
            } else if (
              modelName === "gemini-3-flash-preview" ||
              modelName.includes("flash")
            ) {
              cost = 2.5;
            } else {
              cost = 2.5;
            }
          }

          if (cost > 0) {
            let type = "text";
            if (modelName.includes("image")) type = "image";
            else if (modelName.includes("veo")) type = "video";
            else if (modelName.includes("audio")) type = "audio";

            await apiClient.post("/api/v1/render-jobs/deduct-credits", {
              cost,
              type,
              model: modelName,
            });
          }
        } catch (costError) {
          console.error("Error deducting credits:", costError);
        }
      }

      return;
    } catch (error: unknown) {
      if (timeoutId) clearTimeout(timeoutId);
      const errorStr =
        typeof error === "string"
          ? error
          : (error as Error)?.message || JSON.stringify(error);
      const isTimeout = errorStr.includes("TIMEOUT");
      const isRetryable =
        errorStr.includes("503") ||
        errorStr.includes("UNAVAILABLE") ||
        (error as { status?: number })?.status === 503 ||
        errorStr.includes("high demand") ||
        errorStr.includes("429") ||
        errorStr.includes("RESOURCE_EXHAUSTED") ||
        (error as { status?: number })?.status === 429 ||
        isTimeout ||
        errorStr.includes("fetch failed") ||
        errorStr.includes("overloaded") ||
        errorStr.includes("internal error");

      if (isTimeout) {
        timeoutRetries++;
        if (timeoutRetries > 5) {
          throw new Error(
            "Kết nối mạng không ổn định hoặc máy chủ phản hồi quá lâu. Vui lòng thử lại.",
            { cause: error }
          );
        }
      }

      if (isRetryable) {
        if (i < retries - 1) {
          if (
            i === 1 &&
            params.model &&
            ((params.model as string) === "gemini-3.1-pro-preview" ||
              (params.model as string).includes("pro") ||
              (params.model as string) === "gemini-2.5-flash")
          ) {
            params.model = "gemini-2.5-flash";
          }
          await new Promise((res) => setTimeout(res, delay));
          delay = Math.min(delay * 1.5, 10000);
        } else {
          throw new Error(
            "Hệ thống AI đang quá tải hoặc không phản hồi. Vui lòng thử lại sau ít phút.",
            { cause: error }
          );
        }
      } else {
        throw error;
      }
    }
  }
};

export const scaleToResolution = (
  base64Str: string,
  mimeType: string,
  targetResolution: string,
): Promise<{ base64Data: string; mimeType: string }> => {
  return new Promise((resolve) => {
    let longEdge = 1024;
    if (targetResolution === "2K")
      longEdge = 2560;
    else if (targetResolution === "4K") longEdge = 3840;
    else if (targetResolution === "1K") longEdge = 1024;
    else {
      resolve({ base64Data: base64Str, mimeType });
      return;
    }

    const img = new Image();
    img.src = `data:${mimeType};base64,${base64Str}`;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (Math.max(width, height) <= longEdge) {
        resolve({ base64Data: base64Str, mimeType });
        return;
      }

      const ratio = longEdge / Math.max(width, height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);
        const finalMime = mimeType === "image/png" ? "image/png" : "image/jpeg";
        const quality = finalMime === "image/jpeg" ? 1.0 : undefined;
        const dataUrl = canvas.toDataURL(finalMime, quality);
        const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9]+);base64,(.+)$/);
        if (match) {
          resolve({ base64Data: match[2], mimeType: match[1] });
        } else {
          resolve({ base64Data: base64Str, mimeType });
        }
      } else {
        resolve({ base64Data: base64Str, mimeType });
      }
    };
    img.onerror = () => resolve({ base64Data: base64Str, mimeType });
  });
};

export const resizeImageBase64 = (
  base64Str: string,
  maxWidth = 800,
  maxHeight = 800,
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const format = base64Str.startsWith("data:image/png")
          ? "image/png"
          : "image/jpeg";
        resolve(canvas.toDataURL(format, 0.95));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });
};

export const cacheImage = (url: string, fileOrBlob: File | Blob) => {
  const reader = new FileReader();
  reader.onloadend = () => {
    if (reader.result) {
      globalImageCache[url] = reader.result as string;
    }
  };
  reader.readAsDataURL(fileOrBlob);
};

export const isValidImageBase64 = (base64Str: string): boolean => {
  if (!base64Str) return false;
  const pruned = base64Str.trim().substring(0, 30);
  return (
    pruned.startsWith("iVBORw") ||
    pruned.startsWith("/9j/") ||
    pruned.startsWith("UklGR") ||
    pruned.startsWith("R0lG") ||
    pruned.startsWith("Qk0")
  );
};

export const getImageBase64 = async (
  url: string,
  resize: boolean = true,
  maxWidth = 800,
  maxHeight = 800,
): Promise<{ base64Data: string; mimeType: string }> => {
  let normalizedUrl = url;
  if (normalizedUrl.startsWith("http://") && (normalizedUrl.includes("cloudinary") || normalizedUrl.includes("firebasestorage"))) {
    normalizedUrl = normalizedUrl.replace("http://", "https://");
  }

  let finalBase64 = "";
  let finalMimeType = "";

  if (normalizedUrl.startsWith("data:")) {
    const match = normalizedUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (match && isValidImageBase64(match[2])) {
      finalMimeType = match[1];
      finalBase64 = match[2];
    }
  } else if (globalImageCache[normalizedUrl]) {
    const match = globalImageCache[normalizedUrl].match(
      /^data:(image\/[^;]+);base64,(.+)$/,
    );
    if (match && isValidImageBase64(match[2])) {
      finalMimeType = match[1];
      finalBase64 = match[2];
    } else if (!globalImageCache[normalizedUrl].startsWith("data:")) {
      if (isValidImageBase64(globalImageCache[normalizedUrl])) {
        finalMimeType = "image/jpeg";
        finalBase64 = globalImageCache[normalizedUrl];
      }
    }
  }

  if (!finalBase64 || !finalMimeType || !finalMimeType.startsWith("image/")) {
    const proxyUrls = [
      `/api/proxy-image?url=${encodeURIComponent(normalizedUrl)}`,
      normalizedUrl,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(normalizedUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(normalizedUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(normalizedUrl)}`,
    ];

    let fetched = false;
    for (const proxyUrl of proxyUrls) {
      try {
        const response = await fetch(proxyUrl);
        if (!response.ok) continue;
        const clonedResponse = response.clone();
        const blob = await clonedResponse.blob();

        if (blob.type && !blob.type.startsWith("image/")) {
          continue;
        }

        const res = await new Promise<{ base64Data: string; mimeType: string }>(
          (resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              const match = result.match(/^data:(image\/[^;]+);base64,(.+)$/);
              if (match) {
                if (!isValidImageBase64(match[2])) {
                  reject(new Error("MIME bytes do not match a valid image signature"));
                  return;
                }
                resolve({ mimeType: match[1], base64Data: match[2] });
              } else {
                const calculatedMime = blob.type || "image/jpeg";
                if (!calculatedMime.startsWith("image/")) {
                  reject(new Error("MIME type is not an image type"));
                  return;
                }
                const base64Part = result.split(",")[1] || "";
                if (!isValidImageBase64(base64Part)) {
                  reject(new Error("MIME bytes do not match a valid image signature"));
                  return;
                }
                resolve({
                  mimeType: calculatedMime,
                  base64Data: base64Part,
                });
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          },
        );

        if (res.mimeType && res.mimeType.startsWith("image/")) {
          finalMimeType = res.mimeType;
          finalBase64 = res.base64Data;
          globalImageCache[normalizedUrl] = `data:${finalMimeType};base64,${finalBase64}`;
          fetched = true;
          break;
        }
      } catch {
        // Ignore
      }
    }

    if (!fetched) {
      throw new Error("Failed to fetch image from all proxies");
    }
  }

  if (resize) {
    try {
      const resizedDataUrl = await resizeImageBase64(
        `data:${finalMimeType};base64,${finalBase64}`,
        maxWidth,
        maxHeight,
      );
      const match = resizedDataUrl.match(
        /^data:(image\/[a-zA-Z0-9]+);base64,(.+)$/,
      );
      if (match) {
        finalMimeType = match[1];
        finalBase64 = match[2];
      }
    } catch (e) {
      console.error("Failed to resize image:", e);
    }
  }

  return { mimeType: finalMimeType, base64Data: finalBase64 };
};

export const handleDownload = async (urls: string[]) => {
  for (let i = 0; i < urls.length; i++) {
    try {
      const imageData = await getImageBase64(urls[i], false);
      const byteCharacters = atob(imageData.base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let j = 0; j < byteCharacters.length; j++) {
        byteNumbers[j] = byteCharacters.charCodeAt(j);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: imageData.mimeType });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `igen_image_${Date.now()}_${i}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Error downloading image:", error);
      window.open(urls[i], "_blank");
    }
  }
};
