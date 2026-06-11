import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserModel } from "../model/user.model";
import { IUser } from "../interface/user.interface";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "igen_access_secret_change_me";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "igen_refresh_secret_change_me";
const ACCESS_EXPIRES = "15m";
const REFRESH_EXPIRES = "30d";

export function generateTokens(userId: string, role: string) {
  const accessToken = jwt.sign({ userId, role }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
  const refreshToken = jwt.sign({ userId, role }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): { userId: string; role: string } {
  return jwt.verify(token, ACCESS_SECRET) as { userId: string; role: string };
}

export function verifyRefreshToken(token: string): { userId: string; role: string } {
  return jwt.verify(token, REFRESH_SECRET) as { userId: string; role: string };
}

export const authService = {
  async login(email: string, password: string) {
    const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      throw new Error("Email hoặc mật khẩu không chính xác.");
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error("Email hoặc mật khẩu không chính xác.");
    }
    const { accessToken, refreshToken } = generateTokens(String(user._id), user.role);
    return { accessToken, refreshToken, user };
  },

  async register(email: string, password: string, displayName: string) {
    const existing = await UserModel.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      throw new Error("Email này đã được sử dụng. Vui lòng đăng nhập.");
    }
    if (password.length < 6) {
      throw new Error("Mật khẩu quá yếu. Vui lòng đặt mật khẩu tối thiểu 6 ký tự.");
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const isAdmin =
      email.toLowerCase() === "igen-architect@admin.com" ||
      email.toLowerCase() === "igentech1@gmail.com";

    const user = await new UserModel({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      displayName: displayName.trim() || email.split("@")[0],
      role: isAdmin ? "admin" : "user",
      credits: 0,
      hasSetupApiKey: false,
    }).save();

    const { accessToken, refreshToken } = generateTokens(String(user._id), user.role);
    return { accessToken, refreshToken, user };
  },

  async refreshToken(token: string) {
    const payload = verifyRefreshToken(token);
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      throw new Error("Tài khoản không tồn tại trên hệ thống.");
    }
    const { accessToken, refreshToken } = generateTokens(String(user._id), user.role);
    return { accessToken, refreshToken, user };
  },

  async getMe(userId: string): Promise<IUser | null> {
    return UserModel.findById(userId).select("-password");
  },
};
