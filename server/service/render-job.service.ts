import { RenderJobModel } from "../model/render-job.model";
import { Types } from "mongoose";
import { IRenderJob, RenderJobStatus } from "../interface/render-job.interface";

export const renderJobService = {
  async create(data: {
    userId: string;
    type: string;
    subType?: string;
    inputImageUrls?: string[];
    referenceImageUrls?: string[];
    outputImageUrls?: string[];
    prompt?: string;
    model?: string;
    resolution?: string;
    status?: string;
    progress?: number;
    piapiTaskId?: string;
  }): Promise<IRenderJob> {
    const job = await new RenderJobModel({
      userId: new Types.ObjectId(data.userId),
      type: data.type,
      subType: data.subType || "",
      inputImageUrls: data.inputImageUrls || [],
      referenceImageUrls: data.referenceImageUrls || [],
      outputImageUrls: data.outputImageUrls || [],
      prompt: data.prompt || "",
      status: data.status || "pending",
      progress: data.progress !== undefined ? data.progress : 0,
      model: data.model || "",
      resolution: data.resolution || "1K",
      piapiTaskId: data.piapiTaskId || "",
    }).save();
    return job;
  },

  async getListByUser(userId: string, limit = 50): Promise<IRenderJob[]> {
    return RenderJobModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit);
  },

  async getAll(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [jobs, total] = await Promise.all([
      RenderJobModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      RenderJobModel.countDocuments(),
    ]);
    return { jobs, total, page, limit };
  },

  async getById(jobId: string): Promise<IRenderJob | null> {
    return RenderJobModel.findById(jobId);
  },

  async updateStatus(
    jobId: string,
    status: RenderJobStatus,
    outputImageUrls?: string[],
    progress?: number
  ): Promise<IRenderJob | null> {
    const update: Record<string, unknown> = { status };
    if (outputImageUrls !== undefined) update.outputImageUrls = outputImageUrls;
    if (progress !== undefined) update.progress = progress;
    return RenderJobModel.findByIdAndUpdate(jobId, update, { new: true });
  },

  async deleteJob(jobId: string): Promise<IRenderJob | null> {
    return RenderJobModel.findByIdAndDelete(jobId);
  },

  async deleteAllByUser(userId: string): Promise<void> {
    await RenderJobModel.deleteMany({ userId: new Types.ObjectId(userId) });
  },
};
