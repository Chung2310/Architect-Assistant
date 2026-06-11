import { Document, Types } from "mongoose";

export type TransactionType = "topup" | "image" | "video" | "audio" | "text";

export interface ITransaction extends Omit<Document, "model"> {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  type: TransactionType;
  model?: string;
  timestamp: Date;
  createdAt: Date;
}
