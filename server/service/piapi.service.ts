import dotenv from "dotenv";
import { cloudinaryService } from "./cloudinary.service";

dotenv.config();

const PIAPI_API_KEY = process.env.PIAPI_API_KEY || "";
const PIAPI_BASE_URL = process.env.PIAPI_BASE_URL || "https://api.piapi.ai/api/v1";

console.log(`[PiAPI Service] Loaded API Key status: ${PIAPI_API_KEY ? `Present (Length: ${PIAPI_API_KEY.length}, Prefix: ${PIAPI_API_KEY.substring(0, 8)}...)` : 'Missing'}`);

async function fetchImageAsBase64(url: string): Promise<string> {
  // If it's already a base64 Data URI, return as-is
  if (url.startsWith("data:")) return url;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Hình ảnh đầu vào không tồn tại hoặc đã bị xóa khỏi Cloudinary (mã lỗi: ${response.status}). Vui lòng tải lại ảnh mới lên.`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = response.headers.get("content-type") || "image/png";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export const piapiService = {
  /**
   * Tạo task sinh ảnh bất đồng bộ trên PiAPI
   */
  async createImageTask(
    prompt: string,
    model: string,
    options?: { aspectRatio?: string; image?: string; numImages?: number; jobType?: string }
  ): Promise<{ taskId: string; isMock: boolean; mockUrl?: string; outputUrl?: string }> {
    const openRouterKey = process.env.OPENROUTER_API_KEY || "";
    const openRouterModels = [
      "google/gemini-3.1-flash-image",
      "google/gemini-3-pro-image",
      "google/gemini-3.1-flash-image-preview",
      "google/gemini-3-pro-image-preview"
    ];
    const isMatchedModel = model === "nano-banana-2" || 
                           model === "igen-image-flash" || 
                           model === "nano-banana-pro" || 
                           openRouterModels.includes(model);

    if (openRouterKey && isMatchedModel) {
      console.log(`[OpenRouter Image Task] Creating image synchronously for model: ${model}`);
      let openRouterModel: string;
      
      if (openRouterModels.includes(model)) {
        openRouterModel = model;
      } else if (model === "nano-banana-pro") {
        openRouterModel = "google/gemini-3-pro-image";
      } else {
        openRouterModel = "google/gemini-3.1-flash-image";
      }

      // Normalize aspect ratio to OpenRouter-allowed values for Gemini image models
      const allowedAspects = [
        "1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9"
      ];
      let aspect = options?.aspectRatio || "1:1";
      if (aspect === "Tự động" || aspect === "auto" || !allowedAspects.includes(aspect)) {
        aspect = "1:1";
      }

      const headers: Record<string, string> = {
        "Authorization": `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://staging-architect.igentechsolutions.com",
        "X-Title": "iGen Architect Assistant",
      };

      const content: any[] = [{ type: "text", text: prompt }];

      if (options?.image) {
        console.log(`[OpenRouter Image Task] Passing image URL directly to OpenRouter: ${options.image}`);
        content.push({
          type: "image_url",
          image_url: {
            url: options.image
          }
        });
      }

      const body: Record<string, any> = {
        model: openRouterModel,
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
        image_config: {
          aspect_ratio: aspect
        }
      };

      try {
        console.log(`[OpenRouter Image Task] Requesting OpenRouter chat completions endpoint. Model: ${openRouterModel}`);
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
        console.log("[OpenRouter Image Debug] Raw response:", JSON.stringify(json).slice(0, 1000));

        // Lấy URL ảnh từ response của OpenRouter
        const images = json.choices?.[0]?.message?.images;
        let imgUrl = "";
        if (Array.isArray(images) && images.length > 0) {
          imgUrl = images[0]?.image_url?.url;
        }

        // Fallback: check content array (format cũ / model khác)
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

        let finalImageUrl = "";
        if (imgUrl) {
          finalImageUrl = await cloudinaryService.uploadMedia(imgUrl, "renders");
        } else {
          throw new Error("Không nhận được dữ liệu hình ảnh từ OpenRouter Image API");
        }

        console.log(`[OpenRouter Image Task] Successfully generated and uploaded image: ${finalImageUrl}`);
        const seed = Math.floor(Math.random() * 1000000);
        return {
          taskId: `openrouter-${seed}`,
          isMock: false,
          outputUrl: finalImageUrl
        };
      } catch (error) {
        console.error("[OpenRouter Image Task] Error generating image:", error);
        throw error;
      }
    }

    if (!PIAPI_API_KEY) {
      console.log(`[PiAPI Image Task] Running in MOCK mode (No PIAPI_API_KEY). Model: ${model}`);
      const seed = Math.floor(Math.random() * 1000000);
      return { 
        taskId: `mock-${seed}`, 
        isMock: true, 
        mockUrl: `https://picsum.photos/seed/${seed}/1024/1024` 
      };
    }

    const aspect = options?.aspectRatio || "1:1";
    const randomSeed = Math.floor(Math.random() * 2147483647);
    let reqBody: Record<string, unknown> | undefined;

    const isFloorplanJob = String(options?.jobType || "").toLowerCase().includes("floorplan") || String(options?.jobType || "").toLowerCase().includes("masterplan");

    const isNanoModel = model === "nano-banana-2" || 
                        model === "igen-image-flash" || 
                        model === "nano-banana-pro" ||
                        model.startsWith("google/gemini-3.1-flash-image") ||
                        model.startsWith("google/gemini-3-pro-image");

    if (isNanoModel) {
      let taskType = model === "igen-image-flash" ? "nano-banana-2" : model;
      if (taskType.includes("pro-image")) {
        taskType = "nano-banana-pro";
      } else if (taskType.includes("flash-image")) {
        taskType = "nano-banana-2";
      }
      const hasImage = !!options?.image;
      reqBody = {
        model: "gemini",
        task_type: taskType,
        input: {
          prompt,
          output_format: "png",
          aspect_ratio: aspect,
          resolution: "1K",
          number_of_images: options?.numImages || 1,
          seed: randomSeed,
          ...(hasImage ? { image: options.image, strength: isFloorplanJob ? 0.85 : 0.35 } : {}),
        },
      };
    } else {
      let piapiModel = model.replace("piapi-", "");
      if (piapiModel === "flux") {
        piapiModel = "Qubico/flux1-dev";
      }

      let finalPrompt = prompt;
      if (piapiModel === "midjourney") {
        if (!prompt.includes("--seed")) {
          finalPrompt = `${prompt} --seed ${randomSeed}`;
        }
        if (options?.image && !finalPrompt.includes("--iw") && !isFloorplanJob) {
          finalPrompt = `${finalPrompt} --iw 2.0`;
        }
      }

      const hasImage = !!options?.image && piapiModel !== "midjourney";

      reqBody = {
        model: piapiModel,
        task_type: piapiModel === "midjourney" ? "imagine" : (hasImage ? "img2img" : "txt2img"),
        input: {
          prompt: finalPrompt,
          aspect_ratio: aspect,
          number_of_images: options?.numImages || 1,
          seed: randomSeed,
          ...(options?.image ? { image: options.image } : {}),
          ...(hasImage ? { strength: isFloorplanJob ? 0.85 : 0.35 } : {}),
        },
      };
    }

    try {
      console.log(`[PiAPI Image Task] Requesting task for model ${model}. Body:`, JSON.stringify(reqBody, null, 2));
      const response = await fetch(`${PIAPI_BASE_URL}/task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": PIAPI_API_KEY,
        },
        body: JSON.stringify(reqBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PiAPI task creation failed: ${response.status} - ${errorText}`);
      }

      const json = (await response.json()) as { data?: { task_id?: string } };
      console.log(`[PiAPI Image Task] Task creation response:`, JSON.stringify(json, null, 2));
      const taskId = json.data?.task_id;
      if (!taskId) {
        throw new Error("Không nhận được task_id từ PiAPI");
      }

      return { taskId, isMock: false };
    } catch (error) {
      console.error("[PiAPI Image Task] Error:", error);
      throw error;
    }
  },

  /**
   * Truy vấn trạng thái task của PiAPI
   */
  async getTaskStatus(
    taskId: string
  ): Promise<{ status: "pending" | "processing" | "completed" | "failed"; progress?: number; outputUrl?: string; outputUrls?: string[]; error?: string }> {
    if (taskId.startsWith("mock-")) {
      const mockUrl = `https://picsum.photos/seed/${taskId.replace("mock-", "")}/1024/1024`;
      return {
        status: "completed",
        progress: 100,
        outputUrl: mockUrl,
        outputUrls: [mockUrl]
      };
    }

    try {
      const response = await fetch(`${PIAPI_BASE_URL}/task/${taskId}`, {
        headers: { "x-api-key": PIAPI_API_KEY },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PiAPI task query failed: ${response.status} - ${errorText}`);
      }

      const json = (await response.json()) as {
        data?: {
          status?: "pending" | "processing" | "completed" | "failed";
          progress?: number;
          error?: string;
          output?: {
            image_urls?: string[];
            image_url?: string;
            url?: string;
          };
        };
      };
      const task = json.data;
      console.log(`[PiAPI getTaskStatus] Task ${taskId} query result:`, JSON.stringify(json, null, 2));

      const status = task?.status;
      const progress = task?.progress || (status === "completed" ? 100 : 0);
      let outputUrl = "";
      let outputUrls: string[] = [];

      if (status === "completed") {
        if (task.output?.image_urls && task.output.image_urls.length > 0) {
          outputUrls = task.output.image_urls;
        } else {
          const singleUrl = task.output?.image_url || task.output?.url;
          if (singleUrl) {
            outputUrls = [singleUrl];
          }
        }
        outputUrl = outputUrls[0] || "";
      }

      return {
        status: status || "failed",
        progress,
        outputUrl,
        outputUrls,
        error: task?.error || undefined
      };
    } catch (error) {
      console.error("[PiAPI getTaskStatus] Error:", error);
      throw error;
    }
  },

  /**
   * Sinh ảnh bằng PiAPI (Midjourney, Flux, v.v.) - Đồng bộ (Polling nội bộ)
   */
  async generateImage(
    prompt: string,
    model: string,
    options?: { aspectRatio?: string; image?: string }
  ): Promise<{ url: string; isMock: boolean }> {
    const taskResult = await this.createImageTask(prompt, model, options);
    if (taskResult.isMock) {
      return { url: taskResult.mockUrl || "", isMock: true };
    }
    if (taskResult.outputUrl) {
      return { url: taskResult.outputUrl, isMock: false };
    }

    const taskId = taskResult.taskId;
    console.log(`[PiAPI Image Generation] Task created: ${taskId}. Polling for completion...`);

    let attempts = 0;
    const maxAttempts = 54; // ~4.5 minutes total
    while (attempts < maxAttempts) {
      // Poll faster in first 10 attempts (30s), then every 5s
      const pollInterval = attempts < 10 ? 3000 : 5000;
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      const taskStatus = await this.getTaskStatus(taskId);

      if (taskStatus.status === "completed") {
        if (!taskStatus.outputUrl) {
          throw new Error("Tác vụ hoàn thành nhưng không nhận được URL hình ảnh.");
        }
        return { url: taskStatus.outputUrl, isMock: false };
      } else if (taskStatus.status === "failed") {
        throw new Error(`PiAPI task failed: ${taskStatus.error || "Lỗi không xác định"}`);
      }
      attempts++;
    }

    throw new Error("Quá thời gian chờ tạo ảnh từ PiAPI");
  },

  /**
   * Sinh video bằng PiAPI (Kling, Luma, v.v. và Veo 3.1) - Đồng bộ (Polling nội bộ)
   */
  async generateVideo(
    prompt: string,
    model: string,
    durationSeconds: number = 5,
    options?: { aspectRatio?: string; referenceImageUris?: string[] }
  ): Promise<{ url: string; isMock: boolean }> {
    if (!PIAPI_API_KEY) {
      console.log(`[PiAPI Video Generation] Running in MOCK mode (No PIAPI_API_KEY). Model: ${model}`);
      return { url: "https://www.w3schools.com/html/mov_bbb.mp4", isMock: true };
    }

    const aspect = options?.aspectRatio || "16:9";
    const piapiModel = model.replace("piapi-", "");

    let reqBody: Record<string, unknown> | undefined;

    if (piapiModel.includes("veo31") || piapiModel.includes("veo-3.1") || piapiModel.startsWith("veo3")) {
      let taskType = "veo3.1-video-fast";
      let generateAudio = true;

      if (piapiModel === "veo31-video-audio") {
        taskType = "veo3.1-video";
        generateAudio = true;
      } else if (piapiModel === "veo31-video-fast-audio") {
        taskType = "veo3.1-video-fast";
        generateAudio = true;
      } else if (piapiModel === "veo31-video-fast-no-audio") {
        taskType = "veo3.1-video-fast";
        generateAudio = false;
      }

      // Check for reference image (Image to Video)
      let imageUrl: string | undefined = undefined;
      if (options?.referenceImageUris && options.referenceImageUris.length > 0) {
        const firstImage = options.referenceImageUris[0];
        if (firstImage) {
          if (firstImage.startsWith("data:")) {
            try {
              console.log("[PiAPI Video Generation] Uploading reference image to Cloudinary...");
              imageUrl = await cloudinaryService.uploadMedia(firstImage, "igen_erp/video_refs");
              console.log(`[PiAPI Video Generation] Reference image uploaded: ${imageUrl}`);
            } catch (err) {
              console.error("[PiAPI Video Generation] Failed to upload reference image to Cloudinary:", err);
              imageUrl = firstImage; // Fallback
            }
          } else {
            imageUrl = firstImage;
          }
        }
      }

      reqBody = {
        model: "veo3.1",
        task_type: taskType,
        input: {
          prompt,
          aspect_ratio: aspect,
          duration: `${durationSeconds}s`,
          generate_audio: generateAudio,
          ...(imageUrl ? { image_url: imageUrl } : {}),
        },
      };
    } else {
      reqBody = {
        model: piapiModel,
        task_type: "video_generation",
        input: {
          prompt,
          aspect_ratio: aspect,
          duration: durationSeconds,
        },
      };
    }

    try {
      console.log(`[PiAPI Video Generation] Requesting task for model ${model}. Body:`, JSON.stringify(reqBody, null, 2));
      const response = await fetch(`${PIAPI_BASE_URL}/task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": PIAPI_API_KEY,
        },
        body: JSON.stringify(reqBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PiAPI task creation failed: ${response.status} - ${errorText}`);
      }

      const json = (await response.json()) as { data?: { task_id?: string } };
      console.log(`[PiAPI Video Generation] Task creation response:`, JSON.stringify(json, null, 2));
      const taskId = json.data?.task_id;
      if (!taskId) {
        throw new Error("Không nhận được task_id từ PiAPI");
      }

      console.log(`[PiAPI Video Generation] Task created: ${taskId}. Polling for completion...`);

      let attempts = 0;
      const maxAttempts = 60; // 10 minutes
      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        const pollResponse = await fetch(`${PIAPI_BASE_URL}/task/${taskId}`, {
          headers: { "x-api-key": PIAPI_API_KEY },
        });

        if (pollResponse.ok) {
          const pollJson = (await pollResponse.json()) as {
            data?: {
              status?: string;
              error?: string;
              output?: {
                video?: string;
                video_url?: string;
                url?: string;
              };
            };
          };
          const task = pollJson.data;
          console.log(`[PiAPI Video Generation] Task ${taskId} poll result:`, JSON.stringify(pollJson, null, 2));

          if (task?.status === "completed") {
            const url = task.output?.video || task.output?.video_url || task.output?.url;
            if (!url) {
              throw new Error("Tác vụ hoàn thành nhưng không nhận được URL video.");
            }
            return { url, isMock: false };
          } else if (task?.status === "failed") {
            throw new Error(`PiAPI task failed: ${task.error || "Lỗi không xác định"}`);
          }
        }
        attempts++;
      }

      throw new Error("Quá thời gian chờ tạo video từ PiAPI");
    } catch (error) {
      console.error("[PiAPI Video Generation] Error:", error);
      throw error;
    }
  },
};
