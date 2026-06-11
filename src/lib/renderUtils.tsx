import React, { useState, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";
import { apiClient } from "../services/apiClient";
import { OperationType, handleAppError } from "../config/appConfig";
import { toast } from "sonner";
import { Icon } from "../components/Icon";

export const globalImageCache: Record<string, string> = {};

export const getAIClient = async (modelName: string) => {
  // @ts-ignore
  const isAIStudio = typeof window !== "undefined" && window.aistudio;

  let userApiKey = "";
  try {
    const res = await apiClient.get("/api/v1/auth/me");
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
      modelName === "gemini-3.1-pro-preview" ||
      modelName === "veo-3.1-generate-preview" ||
      modelName === "veo-3.1-lite-generate-preview"
    ) {
      // @ts-ignore
      if (!(await window.aistudio.hasSelectedApiKey())) {
        // @ts-ignore
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

export const safeJsonParse = (text: string): any => {
  if (!text) return null;

  // Clean up potential markdown blocks first
  const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();

  // Try direct parse first
  try {
    return JSON.parse(cleanedText);
  } catch (e) {
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
        return JSON.parse(jsonStr);
      }
    } catch (innerError) {
      // Ignore
    }
    return {};
  }
};

export const checkUserCredits = async (): Promise<boolean> => {
  try {
    const res = await apiClient.get("/api/v1/auth/me");
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
        const res = await apiClient.post("/api/v1/media/upload", {
          file: base64,
          folder: folder
        });
        if (res.success && res.data?.secure_url) {
          resolve(res.data.secure_url);
        } else {
          reject(new Error(res.message || "Tải ảnh lên thất bại. Vui lòng thử lại."));
        }
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Lỗi khi đọc file."));
    reader.readAsDataURL(file);
  });
};

export const generateContentWithRetry = async (
  ai: GoogleGenAI,
  params: any,
  retries = 8,
  delay = 2000,
  timeoutMs = 180000,
) => {
  try {
    const res = await apiClient.get("/api/v1/auth/me");
    if (res.success && res.data) {
      const credits = parseFloat(String(res.data.credits || 0));
      if (credits <= 0) {
        window.dispatchEvent(new CustomEvent("show-topup-modal"));
        throw new Error("Bạn đã hết Credits. Vui lòng nạp thêm.");
      }
    }
  } catch (error: any) {
    if (error.message === "Bạn đã hết Credits. Vui lòng nạp thêm.")
      throw error;
    console.error("Error checking credits:", error);
  }

  let timeoutRetries = 0;
  for (let i = 0; i < retries; i++) {
    let timeoutId: NodeJS.Timeout;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs);
      });

      let result: any;
      const modelName = params.model || "";
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
        ...(config || {}),
        ...(generationConfig || {}),
        ...(rest || {}),
      };

      const callParams = {
        model,
        contents,
        config: combinedConfig,
      } as any;

      if (systemInstruction && !combinedConfig.systemInstruction) {
        combinedConfig.systemInstruction = systemInstruction;
      }

      // Handle nano-banana specific constraints
      if (isNanoBanana) {
        delete (combinedConfig as any).responseMimeType;
        delete (combinedConfig as any).responseSchema;

        if (combinedConfig.systemInstruction) {
          const sysInstr = String(combinedConfig.systemInstruction);
          delete combinedConfig.systemInstruction;

          if (Array.isArray(callParams.contents)) {
            const firstUserContent =
              callParams.contents.find((c: any) => c.role === "user") ||
              callParams.contents[0];
            if (firstUserContent) {
              if (!firstUserContent.parts) firstUserContent.parts = [];
              firstUserContent.parts.unshift({
                text: "SYSTEM INSTRUCTION: " + sysInstr + "\n\n",
              });
            }
          } else if (callParams.contents?.parts) {
            callParams.contents.parts.unshift({
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
            (c: any) => c.parts || [],
          );
          const promptPart = allParts.find((p: any) => p.text);
          prompt = promptPart ? promptPart.text : "";
        } else if (callParams.contents?.parts) {
          const promptPart = callParams.contents.parts.find((p: any) => p.text);
          prompt = promptPart ? promptPart.text : "";
        } else {
          prompt =
            typeof callParams.contents === "string" ? callParams.contents : "";
        }

        const imageConfig = callParams.config?.imageConfig || {};

        const imageResponse = (await Promise.race([
          ai.models.generateImages({
            model: modelName,
            prompt: prompt,
            config: {
              numberOfImages: 1,
              aspectRatio: imageConfig.aspectRatio || "1:1",
              imageSize: imageConfig.imageSize || "1K",
              outputMimeType: "image/png",
            },
          }),
          timeoutPromise,
        ])) as any;

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
        const fullResult = (await Promise.race([
          ai.models.generateContent(callParams),
          timeoutPromise,
        ])) as any;

        const rawResponse = fullResult?.response || fullResult;
        let candidates = rawResponse?.candidates || [];

        if (candidates.length === 0 && rawResponse?.generatedImages) {
          candidates = rawResponse.generatedImages.map((img: any) => ({
            content: {
              parts: [
                {
                  inlineData: {
                    data: img.image?.imageBytes || img.imageBytes,
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
          result.text =
            typeof rawResponse?.text === "function"
              ? rawResponse.text()
              : rawResponse?.text || "";
        } catch (e) {
          result.text = "";
        }

        const promptBlocked =
          result.promptFeedback?.blockReason ||
          (result.promptFeedback?.safetyRatings?.some(
            (r: any) => r.blocked === true,
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
        const modelName = params.model || "";

        if (modelName.includes("image")) {
          const resolution =
            params.generationConfig?.imageConfig?.imageSize ||
            params.config?.imageConfig?.imageSize ||
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
    } catch (error: any) {
      clearTimeout(timeoutId!);
      const errorStr =
        typeof error === "string"
          ? error
          : error?.message || JSON.stringify(error);
      const isTimeout = errorStr.includes("TIMEOUT");
      const isQuotaExceeded =
        errorStr.includes("exceeded its monthly spending cap") ||
        (error?.status === 429 &&
          !errorStr.includes("requests per minute") &&
          errorStr.includes("spend"));
      const isRetryable =
        !isQuotaExceeded &&
        (errorStr.includes("503") ||
          errorStr.includes("UNAVAILABLE") ||
          error?.status === 503 ||
          errorStr.includes("high demand") ||
          errorStr.includes("429") ||
          errorStr.includes("RESOURCE_EXHAUSTED") ||
          error?.status === 429 ||
          isTimeout ||
          errorStr.includes("fetch failed") ||
          errorStr.includes("overloaded") ||
          errorStr.includes("internal error"));

      if (isQuotaExceeded) {
        throw new Error(
          "Bạn đã hết hạn mức chi phí trên Google AI Studio. Vui lòng tăng giới hạn (Set spend cap) tại ai.studio/spend, sau đó chờ 10-15 phút để hệ thống cập nhật.",
        );
      }

      if (isTimeout) {
        timeoutRetries++;
        if (timeoutRetries > 5) {
          throw new Error(
            "Kết nối mạng không ổn định hoặc máy chủ phản hồi quá lâu. Vui lòng thử lại.",
          );
        }
      }

      if (isRetryable) {
        if (i < retries - 1) {
          if (
            i === 1 &&
            params.model &&
            (params.model === "gemini-3.1-pro-preview" ||
              params.model.includes("pro"))
          ) {
            params.model = "gemini-3-flash-preview";
          }
          await new Promise((res) => setTimeout(res, delay));
          delay = Math.min(delay * 1.5, 10000);
        } else {
          throw new Error(
            "Hệ thống AI đang quá tải hoặc không phản hồi. Vui lòng thử lại sau ít phút.",
          );
        }
      } else {
        if (errorStr.includes("403") || error?.status === 403) {
          throw new Error(
            "Lỗi 403: API Key không có quyền truy cập model này hoặc Imagen 3 chưa được kích hoạt. Vui lòng kiểm tra lại API Key.",
          );
        }
        throw error;
      }
    }
  }
};

export const generateContentStreamWithRetry = async function* (
  ai: GoogleGenAI,
  params: any,
  retries = 8,
  delay = 2000,
  timeoutMs = 180000,
) {
  try {
    const res = await apiClient.get("/api/v1/auth/me");
    if (res.success && res.data) {
      const credits = parseFloat(String(res.data.credits || 0));
      if (credits <= 0) {
        window.dispatchEvent(new CustomEvent("show-topup-modal"));
        throw new Error("Bạn đã hết Credits. Vui lòng nạp thêm.");
      }
    }
  } catch (error: any) {
    if (error.message === "Bạn đã hết Credits. Vui lòng nạp thêm.")
      throw error;
    console.error("Error checking credits:", error);
  }

  let timeoutRetries = 0;
  for (let i = 0; i < retries; i++) {
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      const stream = await ai.models.generateContentStream(params);
      const iterator = stream[Symbol.asyncIterator]();

      let lastChunk: any = null;
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
          ])) as IteratorResult<any>;

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
      } catch (iterError: any) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (iterator.return) {
          try {
            await iterator.return(undefined);
          } catch (closeError) {
            // Ignore
          }
        }
        throw iterError;
      }

      if (lastChunk) {
        try {
          let cost = 0;
          const modelName = params.model || "";

          if (modelName.includes("image")) {
            const resolution =
              params.generationConfig?.imageConfig?.imageSize ||
              params.config?.imageConfig?.imageSize ||
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
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);
      const errorStr =
        typeof error === "string"
          ? error
          : error?.message || JSON.stringify(error);
      const isTimeout = errorStr.includes("TIMEOUT");
      const isRetryable =
        errorStr.includes("503") ||
        errorStr.includes("UNAVAILABLE") ||
        error?.status === 503 ||
        errorStr.includes("high demand") ||
        errorStr.includes("429") ||
        errorStr.includes("RESOURCE_EXHAUSTED") ||
        error?.status === 429 ||
        isTimeout ||
        errorStr.includes("fetch failed") ||
        errorStr.includes("overloaded") ||
        errorStr.includes("internal error");

      if (isTimeout) {
        timeoutRetries++;
        if (timeoutRetries > 5) {
          throw new Error(
            "Kết nối mạng không ổn định hoặc máy chủ phản hồi quá lâu. Vui lòng thử lại.",
          );
        }
      }

      if (isRetryable) {
        if (i < retries - 1) {
          if (
            i === 1 &&
            params.model &&
            (params.model === "gemini-3.1-pro-preview" ||
              params.model.includes("pro"))
          ) {
            params.model = "gemini-3-flash-preview";
          }
          await new Promise((res) => setTimeout(res, delay));
          delay = Math.min(delay * 1.5, 10000);
        } else {
          throw new Error(
            "Hệ thống AI đang quá tải hoặc không phản hồi. Vui lòng thử lại sau ít phút.",
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
      } catch (e) {
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

interface ImageLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImages: (imageUrls: string[]) => void;
  target?: "input" | "context" | "character" | "reference";
}

interface MediaItem {
  url: string;
  type: "user_image" | "ai_image" | "user_video" | "ai_video";
  timestamp: number;
}

export const ImageLibraryModal: React.FC<ImageLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectImages,
  target,
}) => {
  const [images, setImages] = useState<MediaItem[]>([]);
  const [filter, setFilter] = useState<
    "all" | "user_image" | "ai_image" | "user_video" | "ai_video"
  >("all");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) {
      setSelectedImages([]);
      setPreviewImage(null);
      setShowDeleteConfirm(false);
      setBrokenUrls(new Set());
    }
  }, [isOpen]);

  const handleSelectAndRecord = (selectedList: string[]) => {
    try {
      const stored = localStorage.getItem("recently_used_media") || "{}";
      const usedMap = JSON.parse(stored);
      const now = Date.now();
      selectedList.forEach((url) => {
        usedMap[url] = now;
      });
      localStorage.setItem("recently_used_media", JSON.stringify(usedMap));
    } catch (e) {
      console.error("Error setting recently used media:", e);
    }
    onSelectImages(selectedList);
  };

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    const fetchMedia = async () => {
      try {
        const res = await apiClient.get("/api/v1/render-jobs?limit=200");
        if (res.success && Array.isArray(res.data)) {
          const fetched: MediaItem[] = [];
          const isVideo = (url: string) => /\.(mp4|webm|mov)/i.test(url);

          res.data.forEach((job: any) => {
            const timestamp = new Date(job.createdAt).getTime();
            
            if (job.outputImageUrls && job.outputImageUrls.length > 0) {
              job.outputImageUrls.forEach((url: string) => {
                if (url) {
                  fetched.push({
                    url,
                    type: isVideo(url) ? "ai_video" : "ai_image",
                    timestamp,
                  });
                }
              });
            }
            if (job.inputImageUrls && job.inputImageUrls.length > 0) {
              job.inputImageUrls.forEach((url: string) => {
                if (url) {
                  fetched.push({
                    url,
                    type: isVideo(url) ? "user_video" : "user_image",
                    timestamp,
                  });
                }
              });
            }
            if (job.referenceImageUrls && job.referenceImageUrls.length > 0) {
              job.referenceImageUrls.forEach((url: string) => {
                if (url) {
                  fetched.push({
                    url,
                    type: isVideo(url) ? "user_video" : "user_image",
                    timestamp,
                  });
                }
              });
            }
          });

          // Unique media items by URL
          const uniqueMedia = Array.from(
            new Map(fetched.map((item) => [item.url, item])).values(),
          );

          let recentlyUsed: Record<string, number> = {};
          try {
            const stored = localStorage.getItem("recently_used_media");
            if (stored) {
              recentlyUsed = JSON.parse(stored);
            }
          } catch (e) {
            console.error("Error parsing recently used media:", e);
          }

          uniqueMedia.sort((a, b) => {
            const timeA = Math.max(a.timestamp, recentlyUsed[a.url] || 0);
            const timeB = Math.max(b.timestamp, recentlyUsed[b.url] || 0);
            return timeB - timeA;
          });

          setImages(uniqueMedia);
        }
      } catch (error) {
        console.error("Error loading library media:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMedia();
  }, [isOpen, target]);

  const toggleSelection = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImages((prev) =>
      prev.includes(url) ? prev.filter((i) => i !== url) : [...prev, url],
    );
  };

  const handleDeleteImages = async () => {
    if (selectedImages.length === 0) return;

    setIsDeleting(true);
    try {
      for (const url of selectedImages) {
        try {
          await apiClient.delete("/api/v1/media", {
            body: { publicId: url }
          });
        } catch (error) {
          console.error("Error deleting image from media library:", error);
        }
      }

      setImages((prev) =>
        prev.filter((img) => !selectedImages.includes(img.url)),
      );
      setSelectedImages([]);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Error in delete process:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-container-lowest w-full max-w-5xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 relative">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
            <Icon name="photo_library" className="text-primary" />
            Thư viện media của bạn
          </h2>
          <div className="flex items-center gap-3">
            {selectedImages.length > 0 && (
              <>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-sm font-medium text-error hover:bg-error/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Icon name="delete" className="text-[18px]" />
                  Xoá đã chọn ({selectedImages.length})
                </button>
                <button
                  onClick={() => setSelectedImages([])}
                  className="text-sm font-medium text-on-surface-variant hover:text-on-surface px-3 py-1.5 rounded-lg hover:bg-surface-container-low transition-colors"
                >
                  Bỏ chọn tất cả
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors text-on-surface-variant"
            >
              <Icon name="close" />
            </button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-container-lowest">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === "all" ? "bg-primary text-white" : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"}`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setFilter("user_image")}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === "user_image" ? "bg-primary text-white" : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"}`}
            >
              Ảnh tải lên
            </button>
            <button
              onClick={() => setFilter("ai_image")}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === "ai_image" ? "bg-primary text-white" : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"}`}
            >
              Ảnh AI tạo
            </button>
            <button
              onClick={() => setFilter("user_video")}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === "user_video" ? "bg-primary text-white" : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"}`}
            >
              Video tải lên
            </button>
            <button
              onClick={() => setFilter("ai_video")}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === "ai_video" ? "bg-primary text-white" : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"}`}
            >
              Video AI tạo
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 relative">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-primary">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="font-medium">Đang tải thư viện...</p>
            </div>
          ) : (() => {
            const itemsToShow = images
              .filter((item) => filter === "all" || item.type === filter)
              .filter((item) => !brokenUrls.has(item.url));

            if (itemsToShow.length === 0) {
              return (
                <div className="h-full flex flex-col items-center justify-center text-on-surface-variant/50">
                  <Icon name="image_not_supported" className="text-6xl mb-4" />
                  <p className="font-medium">Chưa có media nào trong mục này.</p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20">
                {itemsToShow.map((item, index) => {
                  const isSelected = selectedImages.includes(item.url);
                  const isVideo =
                    item.type === "user_video" || item.type === "ai_video";
                  return (
                    <div
                      key={index}
                      className={`relative aspect-square rounded-xl overflow-hidden group cursor-pointer border-2 transition-all shadow-sm ${isSelected ? "border-primary scale-[0.98]" : "border-outline-variant/20 hover:border-primary/50"}`}
                      onClick={() => setPreviewImage(item.url)}
                    >
                      {isVideo ? (
                        <video
                          src={item.url}
                          className="w-full h-full object-cover"
                          onError={() => {
                            setBrokenUrls((prev) => {
                              const next = new Set(prev);
                              next.add(item.url);
                              return next;
                            });
                          }}
                        />
                      ) : (
                        <img
                          src={item.url}
                          alt={`Library item ${index}`}
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                          onError={() => {
                            setBrokenUrls((prev) => {
                              const next = new Set(prev);
                              next.add(item.url);
                              return next;
                            });
                          }}
                        />
                      )}

                      {isVideo && (
                        <div className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-md z-10">
                          <Icon name="play_circle" className="text-[16px]" />
                        </div>
                      )}

                      <div
                        className={`absolute top-3 left-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors z-10 ${isSelected ? "bg-primary border-primary text-white" : "border-white/80 bg-black/20 text-transparent group-hover:border-white"}`}
                        onClick={(e) => toggleSelection(item.url, e)}
                      >
                        <Icon name="check" className="text-[14px]" />
                      </div>

                      <div
                        className={`absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none ${isSelected ? "opacity-0" : ""}`}
                      >
                        <div className="bg-white/90 text-on-surface font-semibold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1 text-sm transform translate-y-2 group-hover:translate-y-0 transition-all">
                          <Icon name="zoom_in" className="text-[16px]" /> Xem trước
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {selectedImages.length > 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-outline-variant/30 px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row items-center gap-3 md:gap-6 animate-in slide-in-from-bottom-8 w-max max-w-[90vw] z-20">
            <span className="font-bold text-on-surface whitespace-nowrap text-sm md:text-base">
              Đã chọn {selectedImages.length} ảnh
            </span>
            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={() => handleDownload(selectedImages)}
                className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-semibold transition-colors whitespace-nowrap text-xs md:text-sm"
              >
                <Icon name="download" className="text-[16px] md:text-[18px]" />
                Tải xuống
              </button>
              <button
                onClick={() => {
                  handleSelectAndRecord(selectedImages);
                  onClose();
                }}
                className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap text-xs md:text-sm"
              >
                <Icon
                  name="check_circle"
                  className="text-[16px] md:text-[18px]"
                />
                Sử dụng ảnh đã chọn
              </button>
            </div>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-outline-variant/20 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-error mb-4">
              <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
                <Icon name="warning" className="text-2xl" />
              </div>
              <h3 className="text-lg font-bold">Xác nhận xóa</h3>
            </div>
            <p className="text-on-surface-variant text-sm mb-6">
              Bạn có chắc chắn muốn xóa {selectedImages.length} ảnh đã chọn khỏi thư viện không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-colors disabled:opacity-50"
                disabled={isDeleting}
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteImages}
                className="px-4 py-2 text-sm font-bold bg-error text-white hover:bg-error/90 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Đang xóa...
                  </>
                ) : (
                  "Xóa vĩnh viễn"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
          >
            <Icon name="close" className="text-2xl" />
          </button>

          <div className="absolute top-6 left-6 flex gap-3 z-10">
            <button
              onClick={() => handleDownload([previewImage])}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors backdrop-blur-sm"
            >
              <Icon name="download" /> Tải xuống
            </button>
            <button
              onClick={() => {
                setSelectedImages([previewImage]);
                setShowDeleteConfirm(true);
                setPreviewImage(null);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors backdrop-blur-sm shadow-lg"
            >
              <Icon name="delete" /> Xóa
            </button>
            <button
              onClick={() => {
                handleSelectAndRecord([previewImage]);
                setPreviewImage(null);
                onClose();
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary hover:bg-primary/90 text-white font-semibold transition-colors shadow-lg"
            >
              <Icon name="check" /> Sử dụng ảnh này
            </button>
          </div>

          <img
            src={previewImage}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
};
