import mongoose, { Schema } from "mongoose";
import { IRenderJob } from "../interface/render-job.interface";

const RenderJobSchema = new Schema<IRenderJob>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    subType: {
      type: String,
      default: "",
    },
    inputImageUrls: {
      type: [String],
      default: [],
    },
    referenceImageUrls: {
      type: [String],
      default: [],
    },
    outputImageUrls: {
      type: [String],
      default: [],
    },
    prompt: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    progress: {
      type: Number,
      default: 0,
    },
    model: {
      type: String,
      default: "",
    },
    resolution: {
      type: String,
      default: "1K",
    },
  },
  {
    timestamps: true,
  }
);

export const RenderJobModel = mongoose.model<IRenderJob>("RenderJob", RenderJobSchema);
