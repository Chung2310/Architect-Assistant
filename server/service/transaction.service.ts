import { TransactionModel } from "../model/transaction.model";
import { Types } from "mongoose";

export const transactionService = {
  async getListByUser(userId: string, limit = 100) {
    return TransactionModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ timestamp: -1 })
      .limit(limit);
  },

  async getAll(page = 1, limit = 100) {
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      TransactionModel.find().sort({ timestamp: -1 }).skip(skip).limit(limit),
      TransactionModel.countDocuments(),
    ]);
    return { transactions, total, page, limit };
  },

  async create(data: {
    userId: string;
    amount: number;
    type: string;
    model: string;
  }) {
    return new TransactionModel({
      userId: new Types.ObjectId(data.userId),
      amount: data.amount,
      type: data.type,
      model: data.model,
      timestamp: new Date(),
    }).save();
  },

  async deleteAllByUser(userId: string): Promise<void> {
    await TransactionModel.deleteMany({ userId: new Types.ObjectId(userId) });
  },
};
