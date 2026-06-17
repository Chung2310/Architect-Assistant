import { GoogleGenAI } from "@google/genai";
import { cloudinaryService } from "./cloudinary.service";
import { piapiService } from "./piapi.service";
import { logger } from "../utils/logger";

export const geminiService = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async generate(params: Record<string, any>, userApiKey?: string): Promise<any> {
    const modelName = (params.model as string) || "";
    const isImageModel =
      modelName.includes("image-preview") ||
      modelName.includes("imagen") ||
      modelName.includes("generateImages") ||
      modelName.includes("banana");
    const isVideoModel = modelName.includes("veo");

    const apiKey = userApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
    const piapiKey = process.env.PIAPI_API_KEY;

    // ─── XỬ LÝ MODEL HÌNH ẢNH / VIDEO QUA PIAPI ─────────────────────────────────
    if (piapiKey && (isImageModel || isVideoModel)) {
      const { contents, generationConfig, config: reqConfig } = params;

      // ─── Xử lý sinh ảnh (Image) ───
      if (isImageModel) {
        let targetModel = "nano-banana-pro";
        if (modelName === "gemini-3-pro-image-preview" || modelName === "nano-banana-pro" || modelName === "igen-image-pro") {
          targetModel = "nano-banana-pro";
        } else if (modelName === "gemini-3.1-flash-image-preview" || modelName === "nano-banana-2" || modelName === "igen-image-flash") {
          targetModel = "nano-banana-2";
        } else if (modelName.includes("image-preview")) {
          targetModel = "nano-banana-pro";
        }

        let promptText = "";
        let inputImageBase64 = "";
        let inputImageMimeType = "";

        const contentsArray = Array.isArray(contents)
          ? contents
          : (contents && contents.parts ? [{ parts: contents.parts }] : []);

        for (const content of contentsArray) {
          if (content.parts && Array.isArray(content.parts)) {
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

        let aspectRatio = "1:1";
        const mergedConfig = { ...(generationConfig || {}), ...(reqConfig || {}) };
        const imageConfig = mergedConfig?.imageConfig || {};
        if (imageConfig.aspectRatio) {
          aspectRatio = imageConfig.aspectRatio;
        }

        let uploadedImageUrl = "";
        if (inputImageBase64) {
          const fileStr = `data:${inputImageMimeType};base64,${inputImageBase64}`;
          logger.info(`[Gemini Service] Uploading input image to Cloudinary...`);
          uploadedImageUrl = await cloudinaryService.uploadMedia(fileStr, "temp_staging");
        }

        logger.info(`[Gemini Service] Generating image via PiAPI. Model: ${targetModel}, Aspect: ${aspectRatio}`);
        const piapiRes = await piapiService.generateImage(promptText, targetModel, {
          aspectRatio,
          image: uploadedImageUrl || undefined
        });

        const imgFetchRes = await fetch(piapiRes.url);
        if (!imgFetchRes.ok) {
          throw new Error(`Failed to download generated image: ${imgFetchRes.status}`);
        }
        const arrayBuffer = await imgFetchRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const mimeType = imgFetchRes.headers.get("content-type") || "image/png";

        return {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      data: base64,
                      mimeType: mimeType
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

      // ─── Xử lý sinh video (Veo) ───
      if (isVideoModel) {
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

        const mergedConfig = { ...(generationConfig || {}), ...(reqConfig || {}) };
        const videoConfig = (mergedConfig?.videoConfig as Record<string, unknown>) || (mergedConfig?.imageConfig as Record<string, unknown>) || {};
        const aspectRatio = (videoConfig.aspectRatio as string) || (mergedConfig.aspectRatio as string) || "16:9";
        const durationSeconds = (videoConfig.durationSeconds as number) || (mergedConfig.durationSeconds as number) || 5;

        logger.info(`[Gemini Service] Generating video via PiAPI. Model: ${piapiVideoModel}, Aspect: ${aspectRatio}, Duration: ${durationSeconds}s`);
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
    }

    // ─── XỬ LÝ MODEL TEXT QUA GOOGLE GENAI SDK ──────────────────────────────────
    if (!apiKey) {
      throw new Error("API Key không hợp lệ hoặc không có quyền truy cập.");
    }

    const ai = new GoogleGenAI({ apiKey: apiKey as string });
    logger.info(`[Gemini Service] Calling Google SDK for text model: ${modelName}`);

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

    const response = await ai.models.generateContent({
      model: modelName,
      contents: params.contents,
      config: sanitizedConfig,
    });

    return response;
  }
};
