import { UserModel } from "../model/user.model";
import { TransactionModel } from "../model/transaction.model";
import { Types } from "mongoose";

export const userService = {
  async getList(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      UserModel.find().select("-password").sort({ createdAt: -1 }).skip(skip).limit(limit),
      UserModel.countDocuments(),
    ]);
    return { users, total, page, limit };
  },

  async getById(userId: string) {
    return UserModel.findById(userId).select("-password");
  },

  async updateRole(userId: string, role: "user" | "admin" | "superadmin") {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select("-password");
    if (!user) throw new Error("Không tìm thấy tài khoản.");
    return user;
  },

  async updateApiKey(userId: string, apiKey: string) {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { apiKey, hasSetupApiKey: true },
      { new: true }
    ).select("-password");
    if (!user) throw new Error("Không tìm thấy tài khoản.");
    return user;
  },

  async updateCredits(userId: string, amount: number, type: "topup" | "deduct" = "topup", model = "Admin Top-up") {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error("Không tìm thấy tài khoản.");

    const delta = type === "deduct" ? -Math.abs(amount) : Math.abs(amount);
    user.credits = (user.credits || 0) + delta;
    await user.save();

    // Log transaction
    await new TransactionModel({
      userId: new Types.ObjectId(userId),
      amount: Math.abs(amount),
      type: type === "topup" ? "topup" : "text",
      model,
      timestamp: new Date(),
    }).save();

    return user;
  },

  async updateProfile(userId: string, data: { displayName?: string; photoURL?: string }) {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { ...data },
      { new: true }
    ).select("-password");
    if (!user) throw new Error("Không tìm thấy tài khoản.");
    return user;
  },

  async deleteUser(userId: string) {
    const user = await UserModel.findByIdAndDelete(userId);
    if (!user) throw new Error("Không tìm thấy tài khoản.");
    return user;
  },

  async getCredits(userId: string): Promise<number> {
    const user = await UserModel.findById(userId).select("credits");
    if (!user) throw new Error("Không tìm thấy tài khoản.");
    return user.credits || 0;
  },

  async deductCredits(userId: string, cost: number, type: string, model: string) {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error("Không tìm thấy tài khoản.");
    if ((user.credits || 0) < cost) throw new Error("Bạn đã hết Credits. Vui lòng nạp thêm.");

    user.credits = (user.credits || 0) - cost;
    await user.save();

    await new TransactionModel({
      userId: new Types.ObjectId(userId),
      amount: cost,
      type,
      model,
      timestamp: new Date(),
    }).save();

    return user.credits;
  },
};
