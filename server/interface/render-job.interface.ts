import { Document, Types } from "mongoose";

export type RenderJobStatus = "pending" | "processing" | "completed" | "failed";

export interface IRenderJobItem {
  productId?: string;
}

export interface IRenderJob extends Omit<Document, "model"> {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: string; // "Ngoại thất" | "Nội thất" | "VR360" | ...
  subType?: string;
  inputImageUrls: string[];
  referenceImageUrls?: string[];
  outputImageUrls: string[];
  prompt?: string;
  status: RenderJobStatus;
  progress?: number;
  model?: string;
  resolution?: string;
  piapiTaskId?: string;
  createdAt: Date;
  updatedAt: Date;
}
