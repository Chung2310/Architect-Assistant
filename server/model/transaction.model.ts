import mongoose, { Schema } from "mongoose";
import { ITransaction } from "../interface/transaction.interface";

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ["topup", "image", "video", "audio", "text"],
      required: true,
      index: true,
    },
    model: {
      type: String,
      default: "",
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const TransactionModel = mongoose.model<ITransaction>("Transaction", TransactionSchema);
