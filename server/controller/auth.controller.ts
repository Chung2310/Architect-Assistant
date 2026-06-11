import { Request, Response } from "express";
import { authService } from "../service/auth.service";
import Joi from "joi";

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Địa chỉ email không đúng định dạng.",
    "any.required": "Email là bắt buộc.",
  }),
  password: Joi.string().min(6).required().messages({
    "string.min": "Mật khẩu tối thiểu 6 ký tự.",
    "any.required": "Mật khẩu là bắt buộc.",
  }),
});

const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Địa chỉ email không đúng định dạng.",
    "any.required": "Email là bắt buộc.",
  }),
  password: Joi.string().min(6).required().messages({
    "string.min": "Mật khẩu tối thiểu 6 ký tự.",
    "any.required": "Mật khẩu là bắt buộc.",
  }),
  displayName: Joi.string().trim().optional().allow(""),
});

export const authController = {
  async login(req: Request, res: Response) {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const { email, password } = req.body;
      const { accessToken, refreshToken, user } = await authService.login(email, password);

      // Gửi refresh token qua httpOnly cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.json({
        success: true,
        data: {
          accessToken,
          user: {
            _id: user._id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            apiKey: user.apiKey,
            credits: user.credits,
            hasSetupApiKey: user.hasSetupApiKey,
          },
        },
      });
    } catch (error: any) {
      res.status(401).json({ success: false, message: error.message || "Đăng nhập thất bại." });
    }
  },

  async register(req: Request, res: Response) {
    const { error } = registerSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: error.details[0].message });
      return;
    }
    try {
      const { email, password, displayName } = req.body;
      const { accessToken, refreshToken, user } = await authService.register(email, password, displayName || "");

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({
        success: true,
        data: {
          accessToken,
          user: {
            _id: user._id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            apiKey: user.apiKey,
            credits: user.credits,
            hasSetupApiKey: user.hasSetupApiKey,
          },
        },
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Đăng ký thất bại." });
    }
  },

  async refreshToken(req: Request, res: Response) {
    const token = req.cookies?.refreshToken;
    if (!token) {
      res.status(401).json({ success: false, message: "Không có refresh token." });
      return;
    }
    try {
      const { accessToken, refreshToken, user } = await authService.refreshToken(token);
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      res.json({
        success: true,
        data: {
          accessToken,
          user: {
            _id: user._id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            apiKey: user.apiKey,
            credits: user.credits,
            hasSetupApiKey: user.hasSetupApiKey,
          },
        },
      });
    } catch (error: any) {
      res.status(401).json({ success: false, message: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại." });
    }
  },

  async getMe(req: any, res: Response) {
    try {
      const user = await authService.getMe(req.user.userId);
      if (!user) {
        res.status(404).json({ success: false, message: "Không tìm thấy tài khoản." });
        return;
      }
      res.json({ success: true, data: user });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Lỗi máy chủ." });
    }
  },

  async logout(req: Request, res: Response) {
    res.clearCookie("refreshToken");
    res.json({ success: true, message: "Đã đăng xuất thành công." });
  },
};
