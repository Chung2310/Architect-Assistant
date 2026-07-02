import { GoogleGenAI } from "@google/genai";
import { cloudinaryService } from "./cloudinary.service";
import { piapiService } from "./piapi.service";
import { logger } from "../utils/logger";

function extractTextFromContents(contents: unknown): string {
  const contentsArray = Array.isArray(contents)
    ? contents
    : (contents && typeof contents === "object" && "parts" in contents
      ? [contents]
      : []);

  let promptText = "";
  for (const content of contentsArray) {
    if (content && typeof content === "object" && "parts" in content) {
      const parts = (content as { parts?: Array<Record<string, unknown>> }).parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (typeof part?.text === "string") {
            promptText += part.text + "\n";
          }
        }
      }
    }
  }

  return promptText.trim();
}

function summarizeContents(contents: unknown): string {
  if (typeof contents === "string") {
    return `string:${contents.slice(0, 120)}`;
  }

  if (!Array.isArray(contents)) {
    return "non-array";
  }

  return contents
    .map((content, index) => {
      if (!content || typeof content !== "object" || !("parts" in content)) {
        return `item${index}:no-parts`;
      }

      const parts = (content as { parts?: Array<Record<string, unknown>> }).parts || [];
      const partSummary = parts.map((part) => {
        if (typeof part?.text === "string") return "text";
        if (part?.inlineData) return "inlineData";
        if (part?.fileData) return "fileData";
        return "other";
      });

      return `item${index}:${partSummary.join(",")}`;
    })
    .join(" | ");
}

function mapToOpenRouterModel(modelName: string): string {
  if (!modelName) {
    return "google/gemini-2.5-flash";
  }
  
  if (modelName.includes("/")) {
    return modelName;
  }

  const name = modelName.toLowerCase().trim();

  const mapping: Record<string, string> = {
    "gemini-2.5-flash": "google/gemini-2.5-flash",
    "gemini-2.0-flash": "google/gemini-2.0-flash",
    "gemini-1.5-flash": "google/gemini-flash-1.5",
    "gemini-1.5-pro": "google/gemini-pro-1.5",
    "gemini-1.5-flash-8b": "google/gemini-flash-1.5-8b",
    "gemini-2.0-flash-exp": "google/gemini-2.0-flash-exp",
    "gemini-2.0-flash-thinking-exp": "google/gemini-2.0-flash-thinking-exp",
    "gemini-2.0-pro-exp": "google/gemini-2.0-pro-exp",
    "gemini-2.5-pro": "google/gemini-2.5-pro",
  };

  if (mapping[name]) {
    return mapping[name];
  }

  return `google/${modelName}`;
}

export const geminiService = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async generate(params: Record<string, any>, _userApiKey?: string): Promise<any> {
    const modelName = (params.model as string) || "";
    const systemInstruction = params.systemInstruction || params.config?.systemInstruction || params.generationConfig?.systemInstruction;
    const isImageModel =
      modelName.includes("image") ||
      modelName.includes("imagen") ||
      modelName.includes("generateImages") ||
      modelName.includes("banana") ||
      modelName.includes("flux") ||
      modelName.includes("midjourney");
    const isVideoModel = modelName.includes("veo");

    const isGeminiNativeImageModel =
      modelName === "gemini-3-pro-image" ||
      modelName === "gemini-3.1-flash-image" ||
      modelName === "gemini-3.1-flash-image-preview" ||
      modelName.startsWith("imagen-");

    // Luôn luôn sử dụng API Key từ biến môi trường .env (không dùng key cá nhân/key từ DB của user nữa)
    let apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
    // Validate API key format - Gemini keys must start with 'AIza' or 'AQ.'
    const isValidGeminiKey = (key: string) => key.startsWith("AIza") || key.startsWith("AQ.");
    if (apiKey && !isValidGeminiKey(apiKey)) {
      logger.warn(`[Gemini Service] API key format invalid (does not start with 'AIza' or 'AQ.'). Trying env fallback.`);
      const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
      if (envKey && isValidGeminiKey(envKey)) {
        apiKey = envKey;
      } else {
        logger.error(`[Gemini Service] No valid Gemini API key found! Both user key and .env key are invalid.`);
      }
    }
    logger.info(`[Gemini Service] Using API key prefix: ${apiKey ? apiKey.substring(0, 10) + '...' : 'None'} (Length: ${apiKey.length}, Valid: ${apiKey ? isValidGeminiKey(apiKey) : false})`);
    const piapiKey = process.env.PIAPI_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY || "";
    logger.info(
      `[Gemini Service] Request summary - model: ${modelName}, hasSystemInstruction: ${!!systemInstruction}, contents: ${summarizeContents(params.contents)}`
    );


    // ─── XỬ LÝ TOÀN BỘ MODEL HÌNH ẢNH QUA OPENROUTER ────────────────────────────
    if (isImageModel) {
      if (!openRouterKey) {
        throw new Error("Không tìm thấy OPENROUTER_API_KEY trong cấu hình hệ thống (.env).");
      }

      const generateViaOpenRouter = async (modelId: string) => {
        const { contents, generationConfig, config: reqConfig } = params;

        let promptText = "";
        let inputImageBase64 = "";
        let inputImageMimeType = "";

        const contentsArray = Array.isArray(contents)
          ? contents
          : (contents && contents.parts ? [{ parts: contents.parts }] : []);

        for (const content of contentsArray) {
          if (content && typeof content === "object" && content.parts && Array.isArray(content.parts)) {
            for (const part of content.parts) {
              if (part.text) {
                promptText += part.text + "\n";
              } else if (part.inlineData && part.inlineData.data) {
                inputImageBase64 = part.inlineData.data;
                inputImageMimeType = part.inlineData.mimeType || "image/jpeg";
              }
            }
          }
        }
        promptText = promptText.trim();
        if (systemInstruction) {
          promptText = `${String(systemInstruction).trim()}\n\n${promptText}`.trim();
        }

        let aspectRatio = "1:1";
        const mergedConfig = { ...(generationConfig || {}), ...(reqConfig || {}) };
        const imageConfig = mergedConfig?.imageConfig || {};
        if (imageConfig.aspectRatio) {
          aspectRatio = imageConfig.aspectRatio;
        }

        // Upload input image if present and model is Gemini
        let uploadedImageUrl = "";
        if (inputImageBase64 && modelId.includes("gemini")) {
          const fileStr = `data:${inputImageMimeType};base64,${inputImageBase64}`;
          logger.info(`[Gemini Service - OpenRouter Image] Uploading input image to Cloudinary...`);
          uploadedImageUrl = await cloudinaryService.uploadMedia(fileStr, "temp_staging");
        }

        // Normalize aspect ratio to OpenRouter allowed aspects
        const allowedAspects = [
          "1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9"
        ];
        let aspect = "1:1";
        if (aspectRatio) {
          const matched = allowedAspects.find(a => aspectRatio.includes(a));
          if (matched) {
            aspect = matched;
          }
        }

        logger.info(`[Gemini Service - OpenRouter Image] Calling OpenRouter images API for model: ${modelId}, aspect: ${aspect}`);
        
        const headers: Record<string, string> = {
          "Authorization": `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://staging-architect.igentechsolutions.com",
          "X-Title": "iGen Architect Assistant",
        };

        const body: Record<string, any> = {
          model: modelId,
          prompt: promptText,
          response_format: "b64_json",
          aspect_ratio: aspect
        };

        if (uploadedImageUrl && modelId.includes("gemini")) {
          body.input_references = [{
            type: "image_url",
            image_url: {
              url: uploadedImageUrl
            }
          }];
        }

        const response = await fetch("https://openrouter.ai/api/v1/images", {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenRouter image generation failed: ${response.status} - ${errorText}`);
        }

        const json = (await response.json()) as {
          data?: Array<{ b64_json?: string; url?: string }>;
        };

        const b64 = json.data?.[0]?.b64_json;
        const imgUrl = json.data?.[0]?.url;

        let finalBase64 = "";
        let finalMimeType = "image/png";

        if (b64) {
          finalBase64 = b64;
        } else if (imgUrl) {
          const imgFetchRes = await fetch(imgUrl);
          if (!imgFetchRes.ok) {
            throw new Error(`Failed to download OpenRouter generated image from URL: ${imgUrl}`);
          }
          const arrayBuffer = await imgFetchRes.arrayBuffer();
          finalBase64 = Buffer.from(arrayBuffer).toString("base64");
          finalMimeType = imgFetchRes.headers.get("content-type") || "image/png";
        } else {
          throw new Error("Không nhận được dữ liệu hình ảnh từ OpenRouter Image API");
        }

        logger.info(`[Gemini Service - OpenRouter Image] Successfully generated image via OpenRouter!`);

        return {
          generatedImages: [{
            image: {
              imageBytes: finalBase64,
              mimeType: finalMimeType
            }
          }],
          candidates: [{
            content: {
              parts: [{
                inlineData: {
                  data: finalBase64,
                  mimeType: finalMimeType
                }
              }],
              role: "model"
            },
            finishReason: "STOP"
          }],
          response: {
            candidates: [{
              content: {
                parts: [{
                  inlineData: {
                    data: finalBase64,
                    mimeType: finalMimeType
                  }
                }],
                role: "model"
              },
              finishReason: "STOP"
            }]
          }
        };
      };

      // Map modelName to OpenRouter model
      let openRouterModel = "google/gemini-3.1-flash-image-preview";
      const lowerModel = modelName.toLowerCase();
      if (
        lowerModel.includes("pro") || 
        lowerModel === "gemini-3-pro-image" || 
        lowerModel === "nano-banana-pro" || 
        lowerModel === "igen-image-pro" ||
        lowerModel.includes("midjourney")
      ) {
        openRouterModel = "google/gemini-3-pro-image-preview";
      }

      try {
        return await generateViaOpenRouter(openRouterModel);
      } catch (err: any) {
        const errStr = err.message || "";
        const isLocationBlock =
          errStr.includes("location") ||
          errStr.includes("supported") ||
          errStr.includes("Studio");

        if (isLocationBlock) {
          logger.warn(`[Gemini Service - OpenRouter Image] Gemini model blocked by location. Falling back to Flux.2 Flex on OpenRouter...`);
          try {
            // Fallback model: Flux.2 Flex on OpenRouter (never geoblocked)
            return await generateViaOpenRouter("black-forest-labs/flux.2-flex");
          } catch (fluxErr: any) {
            throw new Error(`OpenRouter image generation failed: ${fluxErr.message}`);
          }
        }
        throw err;
      }
    }

    // ─── XỬ LÝ MODEL VIDEO QUA PIAPI ───────────────────────────────────────────
    if (piapiKey && isVideoModel) {
      const { contents, generationConfig, config: reqConfig } = params;

      const normalizedModel = modelName.toLowerCase();
      let piapiVideoModel = "veo31-video-fast-audio";

      if (
        normalizedModel === "veo-3.1-generate-preview" ||
        normalizedModel === "veo31-video-audio" ||
        normalizedModel === "piapi-veo31-video-audio" ||
        normalizedModel === "veo"
      ) {
        piapiVideoModel = "veo31-video-audio";
      } else if (
        normalizedModel === "veo-3.1-fast-generate-preview" ||
        normalizedModel === "veo31-video-fast-audio" ||
        normalizedModel === "piapi-veo31-video-fast-audio"
      ) {
        piapiVideoModel = "veo31-video-fast-audio";
      } else if (
        normalizedModel === "veo-3.1-lite-generate-preview" ||
        normalizedModel === "veo31-video-fast-no-audio" ||
        normalizedModel === "piapi-veo31-video-fast-no-audio"
      ) {
        piapiVideoModel = "veo31-video-fast-no-audio";
      } else if (normalizedModel.includes("veo-3.1") || normalizedModel.includes("veo31") || normalizedModel.startsWith("veo3")) {
        piapiVideoModel = "veo31-video-audio";
      }

      let promptText = "";
      const referenceImageUris: string[] = [];
      const contentsArray = Array.isArray(contents)
        ? contents
        : (contents && contents.parts ? [{ parts: contents.parts }] : []);

      for (const content of contentsArray) {
        if (content.parts && Array.isArray(content.parts)) {
          for (const part of content.parts) {
            if (part.text) {
              promptText += part.text + "\n";
            } else if (part.inlineData && part.inlineData.data) {
              referenceImageUris.push(`data:${part.inlineData.mimeType || "image/jpeg"};base64,${part.inlineData.data}`);
            } else if (part.fileData && part.fileData.fileUri) {
              referenceImageUris.push(part.fileData.fileUri);
            }
          }
        }
      }
      promptText = promptText.trim();
      if (systemInstruction) {
        promptText = `${String(systemInstruction).trim()}\n\n${promptText}`.trim();
      }

      const mergedConfig = { ...(generationConfig || {}), ...(reqConfig || {}) };
      const videoConfig = (mergedConfig?.videoConfig as Record<string, unknown>) || (mergedConfig?.imageConfig as Record<string, unknown>) || {};
      const aspectRatio = (videoConfig.aspectRatio as string) || (mergedConfig.aspectRatio as string) || "16:9";
      const durationSeconds = (videoConfig.durationSeconds as number) || (mergedConfig.durationSeconds as number) || 5;

      logger.info(`[Gemini Service] Provider: PiAPI video. Model: ${piapiVideoModel}, Aspect: ${aspectRatio}, Duration: ${durationSeconds}s`);
      const piapiVideoRes = await piapiService.generateVideo(
        promptText,
        piapiVideoModel,
        durationSeconds,
        {
          aspectRatio,
          referenceImageUris: referenceImageUris.length > 0 ? referenceImageUris : undefined,
        }
      );

      return {
        candidates: [
          {
            content: {
              parts: [
                {
                  fileData: {
                    mimeType: "video/mp4",
                    fileUri: piapiVideoRes.url
                  }
                }
              ],
              role: "model"
            },
            finishReason: "STOP"
          }
        ]
      };
    }



    // ── 3. TEXT MODEL via OpenRouter (bắt buộc nếu có OPENROUTER_API_KEY) ──
    if (openRouterKey && !isImageModel && !isVideoModel) {
      const openRouterModel = mapToOpenRouterModel(modelName);
      logger.info(`[Gemini Service] ✅ Provider: OpenRouter → ${openRouterModel}`);

      // Chuyển đổi định dạng contents của Gemini sang messages của OpenAI/OpenRouter
      type OAIMessage = { role: string; content: string };
      const messages: OAIMessage[] = [];

      // System instruction
      if (systemInstruction) {
        messages.push({ role: "system", content: String(systemInstruction) });
      }

      // Contents array
      const contentsArr = Array.isArray(params.contents)
        ? params.contents
        : params.contents ? [params.contents] : [];

      for (const item of contentsArr) {
        if (!item || typeof item !== "object") continue;
        const role = (item as { role?: string }).role === "model" ? "assistant" : "user";
        const parts = (item as { parts?: Array<{ text?: string }> }).parts || [];
        const text = parts.map(p => p.text || "").join("");
        if (text.trim()) messages.push({ role, content: text.trim() });
      }

      if (messages.length === 0) {
        const rawText = extractTextFromContents(params.contents);
        if (rawText) messages.push({ role: "user", content: rawText });
      }

      if (messages.length === 0) {
        throw new Error("Không có nội dung để gửi đến OpenRouter.");
      }

      const requestBody: Record<string, any> = {
        model: openRouterModel,
        messages
      };

      // Ép kiểu JSON nếu frontend yêu cầu JSON
      const isJsonRequested =
        params.config?.responseMimeType === "application/json" ||
        params.generationConfig?.responseMimeType === "application/json" ||
        params.config?.response_mime_type === "application/json";

      if (isJsonRequested) {
        requestBody.response_format = { type: "json_object" };
      }

      logger.info(`[Gemini Service] OpenRouter request: ${messages.length} messages, forced JSON: ${isJsonRequested}`);

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://staging-architect.igentechsolutions.com",
          "X-Title": "iGen Architect Assistant",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter API error ${response.status}: ${errText}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const textResult = data.choices?.[0]?.message?.content || "";
      logger.info(`[Gemini Service] OpenRouter response received (${textResult.length} chars): ${textResult.slice(0, 100)}...`);

      return {
        candidates: [{
          content: {
            parts: [{ text: textResult }],
            role: "model",
          },
          finishReason: "STOP",
        }],
        text: textResult,
      };
    }

    // ─── XỬ LÝ MODEL TEXT QUA GOOGLE GENAI SDK ──────────────────────────────────
    if (!apiKey) {
      throw new Error("API Key không hợp lệ hoặc không có quyền truy cập.");
    }

    const ai = new GoogleGenAI({ apiKey: apiKey as string });
    logger.info(`[Gemini Service] Provider: Gemini text. Model: ${modelName}`);

    // Clone and sanitize config to avoid validation errors on models without thinking support
    const rawConfig = params.config || params.generationConfig || {};
    const sanitizedConfig = { ...rawConfig };

    const isThinkingModel = modelName.toLowerCase().includes("thinking");
    if (!isThinkingModel) {
      if ("thinkingConfig" in sanitizedConfig) {
        delete sanitizedConfig.thinkingConfig;
      }
      if ("thinking_config" in sanitizedConfig) {
        delete sanitizedConfig.thinking_config;
      }
    }

    if (systemInstruction && !("systemInstruction" in sanitizedConfig)) {
      sanitizedConfig.systemInstruction = systemInstruction;
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: params.contents,
      config: sanitizedConfig,
    });

    return response;
  }
};
