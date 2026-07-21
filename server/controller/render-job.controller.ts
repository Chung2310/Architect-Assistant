import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { renderJobService } from "../service/render-job.service";
import { userService } from "../service/user.service";
import { piapiService } from "../service/piapi.service";
import { geminiService } from "../service/gemini.service";
import { openrouterService } from "../service/openrouter.service";
import { cloudinaryService } from "../service/cloudinary.service";
import { emitToUser } from "../socket";
import Joi from "joi";
import { logger } from "../utils/logger";

const createJobSchema = Joi.object({
  type: Joi.string().required().messages({ "any.required": "Loại render là bắt buộc." }),
  subType: Joi.string().allow("").optional(),
  inputImageUrls: Joi.array().items(Joi.string().uri()).optional(),
  referenceImageUrls: Joi.array().items(Joi.string().uri()).optional(),
  prompt: Joi.string().allow("").optional(),
  model: Joi.string().allow("").optional(),
  resolution: Joi.string().valid("1K", "2K", "4K").optional(),
  settings: Joi.object({
    description: Joi.string().allow("").optional(),
    style: Joi.string().allow("").optional(),
    context: Joi.string().allow("").optional(),
    lighting: Joi.string().allow("").optional(),
    colorTone: Joi.string().allow("").optional(),
    prompt: Joi.string().allow("").optional(),
    numImages: Joi.number().optional(),
    aspectRatio: Joi.string().allow("").optional(),
    model: Joi.string().allow("").optional(),
    resolution: Joi.string().valid("1K", "2K", "4K").optional(),
  }).unknown().optional(),
}).unknown();

const idParamSchema = Joi.object({
  id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    "string.pattern.base": "ID không đúng định dạng MongoDB ObjectId.",
    "any.required": "ID là bắt buộc.",
  }),
});

const limitQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).optional().messages({
    "number.base": "Giới hạn phải là số.",
    "number.integer": "Giới hạn phải là số nguyên.",
    "number.min": "Giới hạn tối thiểu là 1.",
  }),
  type: Joi.string().optional(),
});

const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional().messages({
    "number.base": "Trang phải là số.",
    "number.integer": "Trang phải là số nguyên.",
    "number.min": "Trang tối thiểu là 1.",
  }),
  limit: Joi.number().integer().min(1).optional().messages({
    "number.base": "Giới hạn phải là số.",
    "number.integer": "Giới hạn phải là số nguyên.",
    "number.min": "Giới hạn tối thiểu là 1.",
  }),
});

const updateJobSchema = Joi.object({
  status: Joi.string().valid("pending", "processing", "completed", "failed").required().messages({
    "any.only": "Trạng thái không hợp lệ.",
    "any.required": "Trạng thái là bắt buộc.",
  }),
  outputImageUrls: Joi.array().items(Joi.string().uri()).optional(),
  progress: Joi.number().min(0).max(100).optional().messages({
    "number.min": "Tiến trình không được nhỏ hơn 0.",
    "number.max": "Tiến trình không được lớn hơn 100.",
  }),
});

export function appendFloorplanCleanupDirective(type: string, prompt: string) {
  const normalizedType = String(type || "").toLowerCase().trim();
  if (
    normalizedType !== "floorplan to 3d" &&
    normalizedType !== "floorplan to 3d floorplan"
  ) {
    return prompt;
  }

  const cleanupDirective =
    " IMPORTANT: chi giu bo cuc khong gian, tuong, cua, cua so, cau thang va vi tri noi that theo ban ve. INPUT ANALYSIS ORDER (MANDATORY): First read and OCR every room-name label in the source floorplan. Match each label to its exact enclosed wall boundary, written area, position and adjacency. Room labels override furniture-based guesses. Build and lock the immutable room manifest before rendering. ROOM PREFLIGHT (MANDATORY): compare the exact room count by function against the manifest; verify every room remains inside the same enclosing walls and has the same neighbors. Never split, never merge, never relabel, never relocate, never add and never delete a room. If any count, function, boundary or adjacency differs, correct the internal plan before generating the image. VISUAL QUALITY (MANDATORY): high-end photorealistic architectural visualization using true-scale PBR materials with physically correct roughness, reflection, normal detail and texture scale; physically plausible natural lighting, neutral exposure and white balance, soft contact shadows, restrained ambient occlusion, realistic indirect bounce light and subtle surface imperfections. Only after this semantic validation is complete, remove all visible text, room-label glyphs, dimensions and CAD annotations from the final image. Tuyet doi khong duoc them, bot, doi cho, tach, noi, mo rong, thu hep, xoay hoac tai cau truc bat ky thanh phan kien truc nao so voi ban ve goc. Anh cuoi phai la phoi canh 3D sach, khong con annotation hay text ky thuat.";

  if (prompt.includes(cleanupDirective.trim())) {
    return prompt;
  }

  return `${prompt}${cleanupDirective}`;
}

export function appendFloorplanNegativePrompt(type: string, prompt: string) {
  const normalizedType = String(type || "").toLowerCase().trim();
  if (
    normalizedType !== "floorplan to 3d" &&
    normalizedType !== "floorplan to 3d floorplan"
  ) {
    return prompt;
  }

  const negativePrompt =
    " Negative prompt: do not ignore room labels during input analysis, extra room, missing room, split room, merged rooms, changed room function, relabeled room, relocated room, wrong room count, furniture overriding room label, cartoon, illustration, anime, dollhouse, toy-like, miniature model, plastic materials, game asset, low-poly, stylized CGI, pastel toy palette, exaggerated textures, fake lighting, flat shading, uniform materials, oversaturated colors, no room-label glyphs in the final image, no dimensions, no dimension lines, no annotations, no arrows, no hatch patterns, no CAD lines, no dashed lines, no blueprint look, no technical drawing overlay, no title block, no watermark, no 2D graphic remnants, no missing walls, no extra walls, no shifted doors, no shifted windows, no altered room boundaries, no changed circulation, no invented architectural elements, no deleted architectural elements.";

  if (prompt.includes(negativePrompt.trim())) {
    return prompt;
  }

  return `${prompt}${negativePrompt}`;
}

function appendFloorplanCameraDirective(type: string, prompt: string, cameraAngle?: string, customCameraAngle?: string) {
  const normalizedType = String(type || "").toLowerCase().trim();
  if (normalizedType !== "floorplan to 3d") {
    return prompt;
  }

  // Ưu tiên dùng góc chụp người dùng đã chọn
  const selectedAngle = (customCameraAngle || cameraAngle || "").trim();
  if (selectedAngle) {
    // Nếu prompt đã có camera angle rồi thì không thêm nữa
    if (prompt.toLowerCase().includes("camera angle:")) {
      return prompt;
    }
    return `${prompt} Camera angle: ${selectedAngle}. All furniture must remain in exact positions from the floorplan.`;
  }

  // Không có góc chụp nào được chọn — không can thiệp, để AI tự quyết định
  return prompt;
}

function appendFloorplan3DFloorplanCameraDirective(type: string, prompt: string, cameraAngleStyle?: string) {
  const normalizedType = String(type || "").toLowerCase().trim();
  if (normalizedType !== "floorplan to 3d floorplan") {
    return prompt;
  }

  if (prompt.includes("Camera angle:") || prompt.includes("camera angle:")) {
    return prompt;
  }

  const normalizedAngle = String(cameraAngleStyle || "").toLowerCase().trim();
  const cameraDirective = (normalizedAngle.includes("top down") || normalizedAngle.includes("top-down"))
    ? " Camera angle: pure flat 3D top-down view, orthographic projection, looking straight down from 90 degrees above, bird's eye view, layout plan view, flat 3D floor plan layout, no perspective wall distortion."
    : " Camera angle: 3D isometric cutaway view, axonometric cutaway view, 45-degree tilted perspective view, 3D floorplan model visualization.";

  return `${prompt}${cameraDirective}`;
}


function extractPromptPayload(rawPrompt: string) {
  const fallback = {
    finalPrompt: rawPrompt || "",
    negativePrompt: "",
  };

  try {
    const parsed = JSON.parse(rawPrompt);
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }

    const promptObject = parsed as Record<string, unknown>;
    return {
      finalPrompt: String(
        promptObject.prompt_tieng_viet_toi_uu ||
          promptObject.optimized_english_prompt ||
          rawPrompt ||
          "",
      ),
      negativePrompt: String(
        promptObject.prompt_phu_dinh || promptObject.negative_prompt || "",
      ),
    };
  } catch {
    return fallback;
  }
}

function buildGeminiImageContents(
  promptText: string,
  inputImageUrls: string[],
  referenceImageUrls: string[],
) {
  const parts: Array<Record<string, unknown>> = [];

  if (inputImageUrls.length > 0) {
    parts.push({ text: "Reference floorplan images to preserve exactly:" });
    for (const url of inputImageUrls) {
      parts.push({
        fileData: {
          mimeType: "image/jpeg",
          fileUri: url,
        },
      });
    }
  }

  if (referenceImageUrls.length > 0) {
    parts.push({ text: "Additional reference images:" });
    for (const url of referenceImageUrls) {
      parts.push({
        fileData: {
          mimeType: "image/jpeg",
          fileUri: url,
        },
      });
    }
  }

  parts.push({ text: promptText });

  return [{ role: "user", parts }];
}

export const renderJobController = {
  async getMyJobs(req: AuthRequest, res: Response) {
    const { error } = limitQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const limit = parseInt(String(req.query.limit || "50"), 10);
      const type = req.query.type ? String(req.query.type) : undefined;
      const jobs = await renderJobService.getListByUser(req.user!.userId, limit, type);
      logger.info(`[renderJobController.getMyJobs] Retrieved ${jobs.length} jobs for user: ${req.user!.userId} (type: ${type || 'all'})`);
      res.json({ success: true, data: jobs });
    } catch (error) {
      logger.error(`[renderJobController.getMyJobs] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async getJobById(req: AuthRequest, res: Response) {
    const paramValidation = idParamSchema.validate(req.params);
    if (paramValidation.error) {
      res.status(400).json({ success: false, message: paramValidation.error.details[0].message });
      return;
    }
    try {
      const jobId = req.params.id;
      const job = await renderJobService.getById(jobId);
      if (!job) {
        res.status(404).json({ success: false, message: "Không tìm thấy render job." });
        return;
      }
      if (job.userId.toString() !== req.user!.userId) {
        res.status(403).json({ success: false, message: "Bạn không có quyền truy cập render job này." });
        return;
      }
      res.json({ success: true, data: job });
    } catch (error) {
      logger.error(`[renderJobController.getJobById] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async getAllJobs(req: AuthRequest, res: Response) {
    const { error } = paginationQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const page = parseInt(String(req.query.page || "1"), 10);
      const limit = parseInt(String(req.query.limit || "100"), 10);
      const result = await renderJobService.getAll(page, limit);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error(`[renderJobController.getAllJobs] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async createJob(req: AuthRequest, res: Response) {
    const { error } = createJobSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      // Nếu job đã được hoàn thành hoặc thất bại sẵn từ client (ví dụ ở chức năng Đồng bộ)
      if (req.body.status === "completed" || req.body.status === "failed") {
        const job = await renderJobService.create({
          userId: req.user!.userId,
          type: req.body.type,
          subType: req.body.subType,
          inputImageUrls: req.body.inputImageUrls || [],
          referenceImageUrls: req.body.referenceImageUrls || [],
          outputImageUrls: req.body.outputImageUrls || [],
          prompt: req.body.prompt || req.body.settings?.prompt || "",
          model: req.body.model || req.body.settings?.model || "",
          resolution: req.body.resolution || req.body.settings?.resolution || "1K",
          status: req.body.status,
          progress: req.body.progress !== undefined ? req.body.progress : 100,
          piapiTaskId: req.body.piapiTaskId || "",
        });

        logger.info(`[renderJobController.createJob] Completed job saved successfully: ${job._id} | User: ${req.user!.userId}`);
        emitToUser(req.user!.userId, "renderJobUpdated", job);
        res.status(201).json({ success: true, data: job });
        return;
      }

      // Kiểm tra credits trước khi tạo job
      const credits = await userService.getCredits(req.user!.userId);
      if (credits <= 0) {
        res.status(402).json({ success: false, message: "Bạn đã hết Credits. Vui lòng nạp thêm để tiếp tục." });
        return;
      }

      // Kiểm tra xem đây có phải là model của PiAPI không, hỗ trợ cấu trúc settings từ client
      const settings = req.body.settings || {};
      const model = req.body.model || settings.model;
      const prompt = req.body.prompt || settings.prompt;
      const inputImageUrls = req.body.inputImageUrls || [];
      const referenceImageUrls = req.body.referenceImageUrls || [];
      const aspectRatio = req.body.aspectRatio || settings.aspectRatio;
      const resolution = req.body.resolution || settings.resolution || "1K";
      const numImages = req.body.numImages || settings.numImages || 1;

      const GEMINI_NATIVE_MODELS = [
        "gemini-3.1-flash-image",
        "gemini-3-pro-image"
      ];
      const isGeminiNativeModel = GEMINI_NATIVE_MODELS.includes(model);

      let piapiModel = model || "piapi-flux";
      if (
        !isGeminiNativeModel &&
        !piapiModel.startsWith("piapi-") &&
        piapiModel !== "nano-banana-pro" &&
        piapiModel !== "nano-banana-2" &&
        piapiModel !== "igen-image-flash" &&
        piapiModel !== "openrouter-nano-banana-2"
      ) {
        piapiModel = "piapi-flux";
      }

      logger.info(`[renderJobController.createJob] Model: ${model} | piapiModel: ${piapiModel} | type: ${req.body.type}`);
      logger.info(`[renderJobController.createJob] inputImageUrls: ${JSON.stringify(inputImageUrls)} | referenceImageUrls: ${JSON.stringify(referenceImageUrls)}`);

      let piapiTaskId = "";
      let status = "pending";
      let progress = 0;
      let outputImageUrls: string[] = [];

      const promptPayload = extractPromptPayload(prompt || "");
      const parsedPrompt = promptPayload.finalPrompt;
      const parsedNegativePrompt = promptPayload.negativePrompt;

      // Tích hợp link ảnh gốc vào prompt đối với Midjourney
      let finalPrompt = parsedPrompt;
      if (!isGeminiNativeModel && inputImageUrls && inputImageUrls.length > 0) {
        finalPrompt = inputImageUrls.join(" ") + " " + finalPrompt;
      }
      if (parsedNegativePrompt) {
        finalPrompt = `${finalPrompt}\nNegative prompt: ${parsedNegativePrompt}`;
      }
      finalPrompt = appendFloorplanCleanupDirective(req.body.type, finalPrompt);
      finalPrompt = appendFloorplanNegativePrompt(req.body.type, finalPrompt);
      const cameraAngle = req.body.settings?.cameraAngle;
      const customCameraAngle = req.body.settings?.customCameraAngle;
      const cameraAngleStyle = req.body.settings?.cameraAngleStyle;
      finalPrompt = appendFloorplanCameraDirective(req.body.type, finalPrompt, cameraAngle, customCameraAngle);
      finalPrompt = appendFloorplan3DFloorplanCameraDirective(req.body.type, finalPrompt, cameraAngleStyle);

      // Bỏ hậu tố nhãn tiếng Việt (vd: "4:3 (Ngang)" -> "4:3") trước khi gửi cho PiAPI,
      // để tránh giá trị không hợp lệ bị PiAPI âm thầm mặc định về hình vuông 1:1.
      const aspect = (aspectRatio || "").split(" ")[0].trim() || "1:1";

      const isGeminiModel = isGeminiNativeModel;

      if (isGeminiModel) {

        try {
          const user = await userService.getById(req.user!.userId);
          const userApiKey = user?.apiKey || "";

          logger.info(`[renderJobController] Generating image synchronously via Gemini for model: ${piapiModel}`);

          const generatedUrls: string[] = [];
          for (let i = 0; i < numImages; i++) {
            const geminiRes = await geminiService.generate({
              model: model || "gemini-3-pro-image",
              contents: buildGeminiImageContents(
                finalPrompt,
                inputImageUrls,
                referenceImageUrls,
              ),
              config: {
                imageConfig: {
                  aspectRatio: aspect,
                }
              }
            }, userApiKey);

            const base64Data = geminiRes.generatedImages?.[0]?.image?.imageBytes;
            if (!base64Data) {
              throw new Error("Không nhận được dữ liệu ảnh từ Imagen API.");
            }

            const fileStr = `data:image/jpeg;base64,${base64Data}`;
            const uploadedUrl = await cloudinaryService.uploadMedia(fileStr, "renders");
            generatedUrls.push(uploadedUrl);
          }

          outputImageUrls = generatedUrls;
          status = "completed";
          progress = 100;
        } catch (apiErr) {
          logger.error(`[renderJobController] Failed to generate Gemini image: ${apiErr}`);
          res.status(500).json({ success: false, message: "Không thể tạo ảnh từ Gemini: " + (apiErr as Error).message });
          return;
        }
      } else if (piapiModel === "openrouter-nano-banana-2") {
        // OpenRouter trả ảnh đồng bộ ngay trong response, không có task_id để poll,
        // nên xử lý xong hoàn toàn trong request này thay vì đi qua polling.service.ts.
        try {
          logger.info(`[renderJobController] Generating image via OpenRouter (nano-banana 2)`);
          const genResult = await openrouterService.generateImage(finalPrompt, piapiModel, {
            aspectRatio: aspect,
            image: inputImageUrls?.[0],
          });
          const uploadedUrl = await cloudinaryService.uploadMedia(genResult.url, "renders");
          outputImageUrls = [uploadedUrl];
          status = "completed";
          progress = 100;
        } catch (apiErr) {
          logger.error(`[renderJobController] Failed to generate image via OpenRouter: ${apiErr}`);
          res.status(500).json({ success: false, message: "Không thể tạo ảnh qua OpenRouter: " + (apiErr as Error).message });
          return;
        }
      } else {
        try {
          logger.info(`[renderJobController] Creating ${numImages} PiAPI tasks for model: ${piapiModel}`);
          const taskIds: string[] = [];
          const generatedUrls: string[] = [];
          let hasOutputUrl = false;

          for (let i = 0; i < numImages; i++) {
            const taskResult = await piapiService.createImageTask(finalPrompt, piapiModel, {
              aspectRatio: aspect,
              numImages: 1, // Generate 1 image per call
              image: (inputImageUrls && inputImageUrls.length > 0) ? inputImageUrls[0] : undefined,
              jobType: req.body.type
            });
            taskIds.push(taskResult.taskId);
            if (taskResult.outputUrl) {
              generatedUrls.push(taskResult.outputUrl);
              hasOutputUrl = true;
            }
          }
          piapiTaskId = taskIds.join(",");
          if (hasOutputUrl) {
            outputImageUrls = generatedUrls;
            status = "completed";
            progress = 100;
          } else {
            status = "processing";
            progress = 10;
          }
        } catch (apiErr) {
          logger.error(`[renderJobController] Failed to create image generation tasks: ${apiErr}`);
          res.status(500).json({ success: false, message: "Không thể khởi tạo tác vụ sinh ảnh: " + (apiErr as Error).message });
          return;
        }
      }

      const job = await renderJobService.create({
        userId: req.user!.userId,
        type: req.body.type,
        subType: req.body.subType,
        inputImageUrls,
        referenceImageUrls,
        outputImageUrls,
        prompt: finalPrompt,
        model: piapiModel,
        resolution,
        status,
        progress,
        piapiTaskId,
      });

      logger.info(`[renderJobController.createJob] Job created successfully: ${job._id} | Model: ${piapiModel} | User: ${req.user!.userId}`);
      emitToUser(req.user!.userId, "renderJobUpdated", job);
      res.status(201).json({ success: true, data: job });
    } catch (error) {
      logger.error(`[renderJobController.createJob] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async updateJob(req: AuthRequest, res: Response) {
    const paramValidation = idParamSchema.validate(req.params);
    if (paramValidation.error) {
      res.status(400).json({ success: false, message: paramValidation.error.details[0].message });
      return;
    }
    const { error } = updateJobSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const { status, outputImageUrls, progress } = req.body;
      const job = await renderJobService.updateStatus(req.params.id, status, outputImageUrls, progress);
      if (!job) {
        res.status(404).json({ success: false, message: "Không tìm thấy render job." });
        return;
      }
      logger.info(`[renderJobController.updateJob] Job updated successfully: ${job._id} | Status: ${status} | Progress: ${progress}%`);
      emitToUser(job.userId.toString(), "renderJobUpdated", job);
      res.json({ success: true, data: job });
    } catch (error) {
      logger.error(`[renderJobController.updateJob] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async deleteJob(req: AuthRequest, res: Response) {
    const { error } = idParamSchema.validate(req.params);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const job = await renderJobService.deleteJob(req.params.id);
      if (!job) {
        res.status(404).json({ success: false, message: "Không tìm thấy render job." });
        return;
      }
      logger.info(`[renderJobController.deleteJob] Job deleted successfully: ${req.params.id}`);
      res.json({ success: true, message: "Đã xóa render job." });
    } catch (error) {
      logger.error(`[renderJobController.deleteJob] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      res.status(500).json({ success: false, message: errMsg });
    }
  },

  async deductCredits(req: AuthRequest, res: Response) {
    try {
      const { cost, type, model } = req.body;
      if (typeof cost !== "number" || cost <= 0) {
        res.status(400).json({ success: false, message: "Số credits không hợp lệ." });
        return;
      }
      const remainingCredits = await userService.deductCredits(
        req.user!.userId,
        cost,
        type || "text",
        model || "unknown"
      );
      logger.log("info", `[renderJobController.deductCredits] Deducted ${cost} credits for user: ${req.user!.userId}. Remaining: ${remainingCredits}`);
      res.json({ success: true, data: { remainingCredits } });
    } catch (error) {
      logger.error(`[renderJobController.deductCredits] Error: ${error}`);
      const errMsg = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      const statusCode = errMsg.includes("hết Credits") ? 402 : 500;
      res.status(statusCode).json({ success: false, message: errMsg });
    }
  },
};
