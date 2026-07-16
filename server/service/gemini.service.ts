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

async function callOpenRouterChat(
  messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>,
  model: string,
  openRouterKey: string,
  isJsonRequested: boolean
): Promise<{ textResult: string; data: any }> {
  const finalMessages = [...messages];

  if (isJsonRequested) {
    const hasJsonWord = finalMessages.some(m => typeof m.content === "string" && m.content.toLowerCase().includes("json"));
    if (!hasJsonWord) {
      finalMessages.push({ role: "system", content: "You must return a valid JSON object." });
    }
  }

  const requestBody: Record<string, any> = {
    model,
    messages: finalMessages
  };

  if (isJsonRequested) {
    requestBody.response_format = { type: "json_object" };
  }

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

  const data = (await response.json()) as any;
  const textResult = data.choices?.[0]?.message?.content || "";
  return { textResult, data };
}

async function callOpenRouterImage(
  prompt: string,
  model: string,
  openRouterKey: string,
  aspectRatio: string,
  inputImageBase64?: string,
  inputImageMimeType?: string
): Promise<string> {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${openRouterKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://staging-architect.igentechsolutions.com",
    "X-Title": "iGen Architect Assistant",
  };

  const content: any[] = [{ type: "text", text: prompt }];

  if (inputImageBase64) {
    const mime = inputImageMimeType || "image/jpeg";
    const dataUri = `data:${mime};base64,${inputImageBase64}`;
    content.push({
      type: "image_url",
      image_url: {
        url: dataUri
      }
    });
  }

  const allowedAspects = [
    "1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9"
  ];
  let aspect = aspectRatio || "1:1";
  if (aspect === "Tự động" || aspect === "auto" || !allowedAspects.includes(aspect)) {
    aspect = "1:1";
  }

  const body: Record<string, any> = {
    model,
    messages: [{ role: "user", content }],
    modalities: ["image"],
    image_config: {
      aspect_ratio: aspect
    }
  };

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter image generation failed: ${response.status} - ${errorText}`);
  }

  const json = (await response.json()) as any;
  
  // Lấy URL ảnh từ response của OpenRouter
  const images = json.choices?.[0]?.message?.images;
  let imgUrl = "";
  if (Array.isArray(images) && images.length > 0) {
    imgUrl = images[0]?.image_url?.url;
  }

  if (!imgUrl) {
    const messageContent = json.choices?.[0]?.message?.content;
    if (typeof messageContent === "string") {
      if (messageContent.startsWith("http") || messageContent.startsWith("data:")) {
        imgUrl = messageContent;
      }
    } else if (Array.isArray(messageContent)) {
      for (const part of messageContent) {
        if (part?.type === "image_url" && part?.image_url?.url) {
          imgUrl = part.image_url.url;
          break;
        }
        if (part?.type === "image" && part?.source?.data) {
          imgUrl = `data:${part.source.media_type || "image/png"};base64,${part.source.data}`;
          break;
        }
      }
    }
  }

  if (!imgUrl) {
    throw new Error("Không nhận được dữ liệu hình ảnh từ OpenRouter Image API");
  }

  return imgUrl;
}

export const geminiService = {
  async generate(params: Record<string, any>, _userApiKey?: string): Promise<any> {
    const modelName = (params.model as string) || "";
    const systemInstruction = params.systemInstruction || params.config?.systemInstruction || params.generationConfig?.systemInstruction;
    const isImageModel =
      modelName.includes("image-preview") ||
      modelName.includes("imagen") ||
      modelName.includes("generateImages") ||
      modelName.includes("banana");
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
    // ─── XỬ LÝ MODEL HÌNH ẢNH / VIDEO QUA PIAPI ─────────────────────────────────
    if (modelName === "openrouter-nano-banana-2") {
      const { contents, generationConfig, config: reqConfig } = params;
      const openRouterKey = process.env.OPENROUTER_API_KEY || "";
      if (!openRouterKey) {
        throw new Error("Không tìm thấy OpenRouter API Key.");
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
      if (systemInstruction) {
        promptText = `${String(systemInstruction).trim()}\n\n${promptText}`.trim();
      }

      let aspectRatio = "1:1";
      const mergedConfig = { ...(generationConfig || {}), ...(reqConfig || {}) };
      const imageConfig = mergedConfig?.imageConfig || {};
      if (imageConfig.aspectRatio) {
        aspectRatio = imageConfig.aspectRatio;
      }

      logger.info(`[Gemini Service] Provider: OpenRouter image. Model: openrouter-nano-banana-2, Aspect: ${aspectRatio}`);
      const openRouterModel = "google/gemini-3-pro-image-preview";
      const imgUrl = await callOpenRouterImage(
        promptText,
        openRouterModel,
        openRouterKey,
        aspectRatio,
        inputImageBase64 || undefined,
        inputImageMimeType || undefined
      );

      const imgFetchRes = await fetch(imgUrl);
      if (!imgFetchRes.ok) {
        throw new Error(`Failed to download OpenRouter generated image: ${imgFetchRes.status}`);
      }
      const arrayBuffer = await imgFetchRes.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = imgFetchRes.headers.get("content-type") || "image/png";

      return {
        generatedImages: [
          {
            image: {
              imageBytes: base64,
              mimeType: mimeType,
            }
          }
        ],
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

    if (piapiKey && (isImageModel || isVideoModel) && !isGeminiNativeImageModel) {
      const { contents, generationConfig, config: reqConfig } = params;

      // ─── Xử lý sinh ảnh (Image) ───
      if (isImageModel) {
        let targetModel = "nano-banana-pro";
        if (modelName === "gemini-3-pro-image" || modelName === "nano-banana-pro" || modelName === "igen-image-pro") {
          targetModel = "nano-banana-pro";
        } else if (modelName === "gemini-3.1-flash-image" || modelName === "nano-banana-2" || modelName === "igen-image-flash") {
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
        if (systemInstruction) {
          promptText = `${String(systemInstruction).trim()}\n\n${promptText}`.trim();
        }

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

        logger.info(`[Gemini Service] Provider: PiAPI image. Model: ${targetModel}, Aspect: ${aspectRatio}`);
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
    }

    // ─── XỬ LÝ MODEL IMAGEN NATIVE (GEMINI IMAGE GENERATION) ────────────────────
    if (isGeminiNativeImageModel) {
      const imageConfig = params.config?.imageConfig || params.generationConfig?.imageConfig || {};
      const aspectRatio = imageConfig.aspectRatio || "1:1";
      const openRouterKey = process.env.OPENROUTER_API_KEY || "";

      if (openRouterKey) {
        const isFlashVariant =
          modelName === "gemini-3.1-flash-image" ||
          modelName === "gemini-3.1-flash-image-preview" ||
          modelName.includes("flash-image");

        const openRouterModel = isFlashVariant ? "google/gemini-3.1-flash-image" : "google/gemini-3-pro-image";
        logger.info(`[Gemini Service] Provider: OpenRouter (Primary for Native Image). Model: ${openRouterModel}, Aspect: ${aspectRatio}`);

        try {
          const contentItems: any[] = [];

          if (systemInstruction) {
            contentItems.push({ type: "text", text: `SYSTEM INSTRUCTION: ${systemInstruction}\n\n` });
          }

          const contentsArray = Array.isArray(params.contents)
            ? params.contents
            : params.contents
              ? [params.contents]
              : [];

          for (const content of contentsArray) {
            if (content && typeof content === "object" && "parts" in content) {
              const parts = (content as { parts?: any[] }).parts || [];
              for (const part of parts) {
                if (part.text) {
                  contentItems.push({ type: "text", text: part.text });
                } else if (part.inlineData && part.inlineData.data) {
                  const mime = part.inlineData.mimeType || "image/jpeg";
                  contentItems.push({
                    type: "image_url",
                    image_url: {
                      url: `data:${mime};base64,${part.inlineData.data}`
                    }
                  });
                } else if (part.fileData && part.fileData.fileUri) {
                  contentItems.push({
                    type: "image_url",
                    image_url: {
                      url: part.fileData.fileUri
                    }
                  });
                }
              }
            } else if (typeof content === "string") {
              contentItems.push({ type: "text", text: content });
            }
          }

          if (aspectRatio && aspectRatio !== "1:1") {
            contentItems.push({ type: "text", text: `\n[Aspect ratio: ${aspectRatio}]` });
          }

          const requestBody: Record<string, any> = {
            model: openRouterModel,
            messages: [{ role: "user", content: contentItems }],
            modalities: ["image"],
            image_config: {
              aspect_ratio: aspectRatio === "Tự động" || aspectRatio === "auto" ? "1:1" : aspectRatio
            }
          };

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
            const errorText = await response.text();
            throw new Error(`OpenRouter primary image generation failed: ${response.status} - ${errorText}`);
          }

          const json = (await response.json()) as any;
          const images = json.choices?.[0]?.message?.images;
          let imgUrl = "";
          if (Array.isArray(images) && images.length > 0) {
            imgUrl = images[0]?.image_url?.url;
          }

          if (!imgUrl) {
            const messageContent = json.choices?.[0]?.message?.content;
            if (typeof messageContent === "string") {
              if (messageContent.startsWith("http") || messageContent.startsWith("data:")) {
                imgUrl = messageContent;
              }
            } else if (Array.isArray(messageContent)) {
              for (const part of messageContent) {
                if (part?.type === "image_url" && part?.image_url?.url) {
                  imgUrl = part.image_url.url;
                  break;
                }
                if (part?.type === "image" && part?.source?.data) {
                  imgUrl = `data:${part.source.media_type || "image/png"};base64,${part.source.data}`;
                  break;
                }
              }
            }
          }

          if (!imgUrl) {
            throw new Error("Không nhận được dữ liệu hình ảnh từ OpenRouter Image API");
          }

          const imgFetchRes = await fetch(imgUrl);
          if (!imgFetchRes.ok) {
            throw new Error(`Failed to download OpenRouter generated image: ${imgFetchRes.status}`);
          }
          const arrayBuffer = await imgFetchRes.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          const mimeType = imgFetchRes.headers.get("content-type") || "image/png";

          logger.info(`[Gemini Service] Image generated and downloaded successfully via OpenRouter primary.`);

          return {
            generatedImages: [
              {
                image: {
                  imageBytes: base64,
                  mimeType: mimeType,
                }
              }
            ],
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

        } catch (primaryErr: any) {
          logger.error(`[Gemini Service] OpenRouter Primary Image generation failed: ${primaryErr.message || primaryErr}. Falling back to Flux...`);
          
          // Call Fallback to Flux via OpenRouter
          const fallbackFluxModel = process.env.OPENROUTER_FALLBACK_IMAGE_MODEL || "black-forest-labs/flux.2-klein-4b";
          logger.info(`[Gemini Service] Fallback: calling Flux model (${fallbackFluxModel}) via OpenRouter...`);
          try {
            let promptText = "";
            let inputImageBase64 = "";
            let inputImageMimeType = "";

            const contentsArray = Array.isArray(params.contents)
              ? params.contents
              : (params.contents && params.contents.parts ? [{ parts: params.contents.parts }] : []);

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
            if (systemInstruction) {
              promptText = `${String(systemInstruction).trim()}\n\n${promptText}`.trim();
            }

            const imageUrl = await callOpenRouterImage(
              promptText,
              fallbackFluxModel,
              openRouterKey,
              aspectRatio,
              inputImageBase64,
              inputImageMimeType
            );

            const imgFetchRes = await fetch(imageUrl);
            if (!imgFetchRes.ok) {
              throw new Error(`Failed to download generated Flux image: ${imgFetchRes.status}`, { cause: primaryErr });
            }
            const arrayBuffer = await imgFetchRes.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString("base64");
            const mimeType = imgFetchRes.headers.get("content-type") || "image/png";

            logger.info(`[Gemini Service] Fallback Flux image generated and downloaded successfully.`);

            return {
              generatedImages: [
                {
                  image: {
                    imageBytes: base64,
                    mimeType: mimeType,
                  }
                }
              ],
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
          } catch (fallbackErr: any) {
            logger.error(`[Gemini Service] Fallback to Flux via OpenRouter also failed: ${fallbackErr.message || fallbackErr}`);
            throw primaryErr;
          }
        }
      }

      // ─── NATIVE GEMINI SDK FALLBACK (IF NO OPENROUTER KEY) ───────────────────
      logger.info(`[Gemini Service] Fallback: Using native Gemini SDK.`);
      if (!apiKey) {
        throw new Error("API Key không hợp lệ hoặc không có quyền truy cập.");
      }

      const ai = new GoogleGenAI({ apiKey: apiKey as string });
      logger.info(`[Gemini Service] Provider: Gemini native image. Requested model: ${modelName}`);

      const isFlashVariant =
        modelName === "gemini-3.1-flash-image" ||
        modelName === "gemini-3.1-flash-image-preview" ||
        modelName.includes("flash-image");

      const IMAGE_GEN_MODEL = isFlashVariant ? "gemini-3.1-flash-image" : "gemini-3-pro-image";
      logger.info(`[Gemini Service] Using model: ${IMAGE_GEN_MODEL} (variant: ${isFlashVariant ? 'flash' : 'pro'}), aspect: ${aspectRatio}`);

      const contentsArray = Array.isArray(params.contents)
        ? params.contents
        : params.contents
          ? [params.contents]
          : [];

      const aspectRatioPart =
        aspectRatio && aspectRatio !== "1:1"
          ? [{ text: `[Aspect ratio: ${aspectRatio}]` }]
          : [];

      const finalContents = contentsArray.length > 0
        ? contentsArray.map((content, index) => {
            if (
              index === contentsArray.length - 1 &&
              content &&
              typeof content === "object" &&
              "parts" in content &&
              Array.isArray((content as { parts?: unknown[] }).parts)
            ) {
              const typedContent = content as {
                role?: string;
                parts: Array<Record<string, unknown>>;
              };

              return {
                role: typedContent.role,
                parts: [...typedContent.parts, ...aspectRatioPart],
              };
            }

            return content;
          })
        : typeof params.contents === "string"
          ? `${params.contents}${aspectRatioPart.length > 0 ? `\n[Aspect ratio: ${aspectRatio}]` : ""}`
          : extractTextFromContents(params.contents);

      const imageConfigForSdk: Record<string, unknown> = {
        responseModalities: ["TEXT", "IMAGE"],
      };
      if (systemInstruction) {
        imageConfigForSdk.systemInstruction = systemInstruction;
      }

      let response;

      try {
        response = await ai.models.generateContent({
          model: IMAGE_GEN_MODEL,
          contents: finalContents,
          config: imageConfigForSdk,
        });
      } catch (err: any) {
        const errStr = err?.message || JSON.stringify(err) || "";
        const statusCode = err?.status || err?.statusCode || 0;
        logger.error(`[Gemini Service] Native Image generation failed (Status: ${statusCode}, Msg: ${errStr}).`);

        const fallbackOpenRouterKey = process.env.OPENROUTER_API_KEY || "";
        if (fallbackOpenRouterKey) {
          const fallbackFluxModel = process.env.OPENROUTER_FALLBACK_IMAGE_MODEL || "black-forest-labs/flux.2-klein-4b";
          logger.info(`[Gemini Service] Fallback: calling Flux model (${fallbackFluxModel}) via OpenRouter due to Gemini Native Image failure...`);
          try {
            let promptText = "";
            let inputImageBase64 = "";
            let inputImageMimeType = "";

            const contentsArray = Array.isArray(params.contents)
              ? params.contents
              : (params.contents && params.contents.parts ? [{ parts: params.contents.parts }] : []);

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
            if (systemInstruction) {
              promptText = `${String(systemInstruction).trim()}\n\n${promptText}`.trim();
            }

            const imageUrl = await callOpenRouterImage(
              promptText,
              fallbackFluxModel,
              fallbackOpenRouterKey,
              aspectRatio,
              inputImageBase64,
              inputImageMimeType
            );

            const imgFetchRes = await fetch(imageUrl);
            if (!imgFetchRes.ok) {
              throw new Error(`Failed to download generated Flux image: ${imgFetchRes.status}`, { cause: err });
            }
            const arrayBuffer = await imgFetchRes.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString("base64");
            const mimeType = imgFetchRes.headers.get("content-type") || "image/png";

            logger.info(`[Gemini Service] Fallback Flux image generated and downloaded successfully.`);

            return {
              generatedImages: [
                {
                  image: {
                    imageBytes: base64,
                    mimeType: mimeType,
                  }
                }
              ],
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
          } catch (fallbackErr: any) {
            logger.error(`[Gemini Service] Fallback to Flux via OpenRouter also failed: ${fallbackErr.message || fallbackErr}`);
            throw err;
          }
        } else {
          throw err;
        }
      }

      const parts = response.candidates?.[0]?.content?.parts || [];
      const imageParts = parts.filter((p: { inlineData?: { data?: string; mimeType?: string } }) => p.inlineData?.data);
      if (imageParts.length === 0) {
        throw new Error("Không nhận được dữ liệu ảnh từ mô hình native của Gemini.");
      }

      return {
        generatedImages: imageParts.map((p: { inlineData: { data: string; mimeType: string } }) => ({
          image: {
            imageBytes: p.inlineData.data,
            mimeType: p.inlineData.mimeType || "image/jpeg",
          }
        })),
        candidates: response.candidates,
      };
    }

    // ── 3. TEXT MODEL ──
    if (!isImageModel && !isVideoModel) {
      // Chuyển đổi định dạng contents của Gemini sang messages của OpenAI/OpenRouter (multimodal)
      type OAIContentPart = { type: string; text?: string; image_url?: { url: string } };
      type OAIMessage = { role: string; content: string | OAIContentPart[] };
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
        const parts = (item as { parts?: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }).parts || [];
        
        // Build multimodal content array if image parts exist
        const contentParts: OAIContentPart[] = [];
        for (const p of parts) {
          if (p.inlineData?.data) {
            contentParts.push({
              type: "image_url",
              image_url: { url: `data:${p.inlineData.mimeType || "image/jpeg"};base64,${p.inlineData.data}` }
            });
          } else if (p.text?.trim()) {
            contentParts.push({ type: "text", text: p.text.trim() });
          }
        }

        if (contentParts.length === 0) continue;
        const onlyText = contentParts.every(p => p.type === "text");
        messages.push({ role, content: onlyText ? contentParts.map(p => p.text || "").join("") : contentParts });
      }

      if (messages.length === 0) {
        const rawText = extractTextFromContents(params.contents);
        if (rawText) messages.push({ role: "user", content: rawText });
      }

      const isJsonRequested =
        params.config?.responseMimeType === "application/json" ||
        params.generationConfig?.responseMimeType === "application/json" ||
        params.config?.response_mime_type === "application/json";

      const fallbackQwenModel = process.env.OPENROUTER_FALLBACK_MODEL || "qwen/qwen3.6-flash";

      const isSyncTextRequest =
        params.promptTemplateKey === "sync_analyze_prompt" ||
        params.promptTemplateKey === "sync_suggestion_update_prompt";

      if (isSyncTextRequest) {
        logger.info(`[Gemini Service] Sync text request detected. Running custom fallback flow.`);
        
        if (openRouterKey) {
          try {
            logger.info(`[Gemini Service] Sync text: calling google/gemini-2.5-flash via OpenRouter...`);
            const { textResult } = await callOpenRouterChat(messages, "google/gemini-2.5-flash", openRouterKey, isJsonRequested);
            logger.info(`[Gemini Service] Sync text: google/gemini-2.5-flash via OpenRouter successful.`);
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
          } catch (syncErr: any) {
            logger.warn(`[Gemini Service] Sync text: OpenRouter Gemini failed: ${syncErr.message || syncErr}. Falling back to Qwen...`);
            
            try {
              logger.info(`[Gemini Service] Sync text: calling Qwen model (${fallbackQwenModel}) via OpenRouter...`);
              const { textResult } = await callOpenRouterChat(messages, fallbackQwenModel, openRouterKey, isJsonRequested);
              logger.info(`[Gemini Service] Sync text: Qwen via OpenRouter successful.`);
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
            } catch (syncQwenErr: any) {
              logger.warn(`[Gemini Service] Sync text: Qwen via OpenRouter failed: ${syncQwenErr.message || syncQwenErr}. Falling back to Native...`);
              
              const hasValidNativeKey = apiKey && isValidGeminiKey(apiKey);
              if (hasValidNativeKey) {
                try {
                  const ai = new GoogleGenAI({ apiKey: apiKey as string });
                  logger.info(`[Gemini Service] Sync text: calling Gemini Native SDK...`);
                  
                  const rawConfig = params.config || params.generationConfig || {};
                  const sanitizedConfig = { ...rawConfig };
                  const isThinkingModel = modelName.toLowerCase().includes("thinking");
                  if (!isThinkingModel) {
                    delete sanitizedConfig.thinkingConfig;
                    delete sanitizedConfig.thinking_config;
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
                } catch (syncNativeErr: any) {
                  logger.error(`[Gemini Service] Sync text: Gemini Native SDK failed: ${syncNativeErr.message || syncNativeErr}`);
                  throw new Error(`Tất cả các dịch vụ cho Sync Text đều thất bại. Lỗi Native: ${syncNativeErr.message}`, { cause: syncNativeErr });
                }
              } else {
                throw new Error(`OpenRouter Gemini và Qwen đều thất bại trong Sync Text, và không có API Key hợp lệ cho Gemini Native.`, { cause: syncQwenErr });
              }
            }
          }
        } else {
          logger.info(`[Gemini Service] Sync text: No OpenRouter key found. Trying Gemini Native SDK...`);
          const hasValidNativeKey = apiKey && isValidGeminiKey(apiKey);
          if (hasValidNativeKey) {
            try {
              const ai = new GoogleGenAI({ apiKey: apiKey as string });
              logger.info(`[Gemini Service] Sync text: Provider: Gemini Native (No OpenRouter Key). Model: ${modelName}`);
              
              const rawConfig = params.config || params.generationConfig || {};
              const sanitizedConfig = { ...rawConfig };
              const isThinkingModel = modelName.toLowerCase().includes("thinking");
              if (!isThinkingModel) {
                delete sanitizedConfig.thinkingConfig;
                delete sanitizedConfig.thinking_config;
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
            } catch (syncNativeErr2: any) {
              logger.error(`[Gemini Service] Sync text: Gemini Native SDK (No OpenRouter) failed: ${syncNativeErr2.message || syncNativeErr2}`);
              throw syncNativeErr2;
            }
          } else {
            throw new Error("Không tìm thấy API Key hợp lệ cho Gemini Native hoặc OpenRouter.");
          }
        }
      }

      if (openRouterKey) {
        const openRouterModel = mapToOpenRouterModel(modelName);
        logger.info(`[Gemini Service] Provider: OpenRouter (Primary). Model: ${openRouterModel}`);

        try {
          if (messages.length === 0) {
            throw new Error("Không có nội dung để gửi đến OpenRouter.");
          }
          const { textResult } = await callOpenRouterChat(messages, openRouterModel, openRouterKey, isJsonRequested);
          logger.info(`[Gemini Service] OpenRouter Gemini response received (${textResult.length} chars): ${textResult.slice(0, 100)}...`);
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
        } catch (openRouterErr: any) {
          logger.warn(`[Gemini Service] Gemini via OpenRouter failed: ${openRouterErr.message || openRouterErr}. Falling back to Qwen...`);
          
          try {
            const { textResult } = await callOpenRouterChat(messages, fallbackQwenModel, openRouterKey, isJsonRequested);
            logger.info(`[Gemini Service] Fallback OpenRouter Qwen response received (${textResult.length} chars)`);
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
          } catch (qwenErr: any) {
            logger.warn(`[Gemini Service] Qwen via OpenRouter failed: ${qwenErr.message || qwenErr}. Falling back to Gemini Native SDK...`);
            
            const hasValidNativeKey = apiKey && isValidGeminiKey(apiKey);
            if (hasValidNativeKey) {
              try {
                const ai = new GoogleGenAI({ apiKey: apiKey as string });
                logger.info(`[Gemini Service] Fallback Provider: Gemini Native. Model: ${modelName}`);

                const rawConfig = params.config || params.generationConfig || {};
                const sanitizedConfig = { ...rawConfig };
                const isThinkingModel = modelName.toLowerCase().includes("thinking");
                if (!isThinkingModel) {
                  delete sanitizedConfig.thinkingConfig;
                  delete sanitizedConfig.thinking_config;
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
              } catch (nativeErr: any) {
                logger.error(`[Gemini Service] Fallback Gemini Native SDK also failed: ${nativeErr.message || nativeErr}`);
                throw new Error(`Tất cả các dịch vụ (OpenRouter Gemini, Qwen và Gemini Native) đều thất bại. Lỗi Native: ${nativeErr.message}`, { cause: nativeErr });
              }
            } else {
              throw new Error(`OpenRouter Gemini và Qwen đều thất bại, và không có API Key hợp lệ cho Gemini Native.`, { cause: qwenErr });
            }
          }
        }
      } else {
        // Không có OpenRouter Key -> chuyển thẳng sang Gemini Native SDK làm phương án duy nhất
        const hasValidNativeKey = apiKey && isValidGeminiKey(apiKey);
        if (hasValidNativeKey) {
          try {
            const ai = new GoogleGenAI({ apiKey: apiKey as string });
            logger.info(`[Gemini Service] Provider: Gemini Native (No OpenRouter Key). Model: ${modelName}`);

            const rawConfig = params.config || params.generationConfig || {};
            const sanitizedConfig = { ...rawConfig };
            const isThinkingModel = modelName.toLowerCase().includes("thinking");
            if (!isThinkingModel) {
              delete sanitizedConfig.thinkingConfig;
              delete sanitizedConfig.thinking_config;
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
          } catch (nativeErr: any) {
            logger.error(`[Gemini Service] Gemini Native SDK failed: ${nativeErr.message || nativeErr}`);
            throw nativeErr;
          }
        } else {
          throw new Error("Không tìm thấy API Key hợp lệ cho OpenRouter hoặc Gemini Native.");
        }
      }
    }
  },
  async chatOpenRouter(messages: Array<{ role: string; content: string }>, model = "google/gemini-2.5-flash"): Promise<{ text: string }> {
    const openRouterKey = process.env.OPENROUTER_API_KEY || "";
    if (!openRouterKey) {
      throw new Error("Không tìm thấy OpenRouter API Key.");
    }

    const systemInstruction = `Bạn là Trợ lý ảo AI của iGen (iGen Architect Assistant), chuyên gia tư vấn và hướng dẫn sử dụng phần mềm Thiết kế kiến trúc và Dựng hình iGen.
Nhiệm vụ của bạn:
1. Hướng dẫn chi tiết từng bước cho người dùng cách thực hiện các tác vụ trong ứng dụng iGen này (ví dụ: các bước render ngoại thất, thay đổi vật liệu, vẽ ghi chú,...).
2. Trả lời các câu hỏi liên quan đến kiến trúc, thiết kế nội thất, ngoại thất, kỹ thuật dựng hình phối cảnh (rendering) trong phạm vi dự án.
3. Không trả lời các câu hỏi ngoài phạm vi kiến trúc và hướng dẫn sử dụng phần mềm. Nếu người dùng hỏi các câu hỏi ngoài lề (như toán học, lập trình, ẩm thực,...), hãy lịch sự từ chối và hướng họ quay lại chủ đề kiến trúc.

Các tính năng chính của phần mềm iGen để bạn hướng dẫn người dùng:
- Tab [Render] (Dựng hình): Cho phép dựng phối cảnh 3D từ ảnh vẽ nét, mặt bằng phác thảo hoặc ảnh chụp hiện trạng. Hỗ trợ các chế độ:
  + Render Ngoại Thất: Dựng phối cảnh 3D mặt tiền, sân vườn, bên ngoài công trình. Cách thực hiện:
    1. Tải ảnh phác thảo/ảnh hiện trạng/ảnh vẽ nét lên tại mục "1. Tải Lên Ảnh Ngoại Thất".
    2. Tại mục "2. Mô Tả & Tùy Chọn", nhập mô tả mong muốn hoặc chọn ý tưởng phong cách có sẵn.
    3. Chọn Model và Độ phân giải phù hợp ở cột bên phải.
    4. Nhấn nút "Render" màu đen. Kết quả sẽ hiển thị ở khung bên phải sau vài giây.
  + Render Nội Thất: Dựng phối cảnh phòng khách, phòng ngủ, phòng ăn... Các bước thực hiện tương tự Render Ngoại thất.
  + Floorplan to 3D: Dựng phối cảnh không gian 3D từ ảnh chụp mặt bằng 2D thông thường.
  + Floorplan to 3D Floorplan: Tạo bản vẽ 3D cắt bóc mái (axonometric).
- Tab [Cải thiện Render]: Làm sắc nét và tinh chỉnh chi tiết cho ảnh phối cảnh 3D có sẵn.
- Tab [Upscale]: Nâng phân giải ảnh lên 2K/4K siêu sắc nét.
- Tab [Đồng bộ]: Đồng nhất phong cách và cấu trúc hình ảnh giữa nhiều góc chụp khác nhau.
- Tab [Chỉnh sửa] (Image Editor):
  + Crop để sửa: Chọn một vùng cụ thể trên ảnh để vẽ lại bằng AI.
  + Thay Thế Model: Chọn vùng và tải lên một đồ vật/model mới để thay thế đồ vật cũ.
  + Thêm Đối Tượng: Đưa thêm đồ vật (ví dụ thêm chậu cây, bộ sofa) vào vùng chỉ định.
  + Đổi Vật Liệu: Thay đổi bề mặt vật liệu (ví dụ sàn gỗ thành gạch terrazzo).
  + Ghi Chú (Visual Annotation): Dùng bút vẽ khoanh vùng/kẻ mũi tên và viết ghi chú chữ bằng tiếng Việt (ví dụ: "đổi ghế thành màu đen") trực tiếp lên ảnh, AI sẽ tự động đọc ghi chú và sửa ảnh theo ý muốn.
- Tab [Canvas]: Vẽ và sắp xếp các đối tượng trên bảng vẽ 2D tự do.
- Công cụ [Vẽ Mặt Bằng] (Floor Plan Editor - truy cập từ menu bên trái): Thiết kế bản vẽ 2D, kéo thả phòng, đặt đồ đạc nội thất và bật chế độ camera 3D (Visualize) để ngắm nhìn trực quan.

Quy tắc trả lời:
- BẮT BUỘC: Chỉ được trả lời bằng tiếng Việt chuẩn 100%, tuyệt đối không sử dụng ngôn ngữ khác.
- Luôn thân thiện, chuyên nghiệp.
- BẮT BUỘC: Câu trả lời phải cực kỳ ngắn gọn, súc tích (tối đa 2-3 câu hoặc 50-70 từ). Tuyệt đối không giải thích dài dòng hay lan man, đi thẳng vào câu trả lời hoặc hướng dẫn cụ thể.
- Khi hướng dẫn các bước thực hiện, hãy tóm tắt các bước siêu ngắn gọn, súc tích (ví dụ: "1. Tải ảnh lên. 2. Nhập mô tả. 3. Nhấn Render."), tuyệt đối không viết thêm chi tiết mô tả dài dòng cho từng bước.`;

    const finalMessages = [
      { role: "system", content: systemInstruction },
      ...messages
    ];

    const FALLBACK_MODEL = "qwen/qwen3.6-flash";

    try {
      const { textResult } = await callOpenRouterChat(finalMessages, model, openRouterKey, false);
      return { text: textResult };
    } catch (primaryErr: any) {
      if (model === FALLBACK_MODEL) {
        // Đã đang dùng fallback, không retry nữa
        throw primaryErr;
      }
      logger.warn(
        `[Chatbot] Model "${model}" lỗi: ${primaryErr?.message || primaryErr}. Tự động chuyển sang fallback: "${FALLBACK_MODEL}".`
      );
      try {
        const { textResult } = await callOpenRouterChat(finalMessages, FALLBACK_MODEL, openRouterKey, false);
        return { text: textResult };
      } catch (fallbackErr: any) {
        logger.error(`[Chatbot] Fallback model "${FALLBACK_MODEL}" cũng lỗi: ${fallbackErr?.message || fallbackErr}.`);
        throw primaryErr; // Trả về lỗi gốc cho controller
      }
    }
  }
};
