import { apiClient } from "./apiClient";

export interface User {
  _id: string;
  email: string;
  displayName: string;
  role: "user" | "admin" | "superadmin";
  apiKey?: string;
  credits: number;
  hasSetupApiKey: boolean;
}

export const authService = {
  async login(email: string, password: string): Promise<User> {
    const res = await apiClient.post("/api/v1/auth/login", { email, password });
    apiClient.setAccessToken(res.data.accessToken);
    return res.data.user;
  },

  async register(email: string, password: string, displayName: string): Promise<User> {
    const res = await apiClient.post("/api/v1/auth/register", { email, password, displayName });
    apiClient.setAccessToken(res.data.accessToken);
    return res.data.user;
  },

  async getMe(): Promise<User> {
    const res = await apiClient.get("/api/v1/auth/me");
    return res.data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post("/api/v1/auth/logout");
    } catch (e) {
      // Bỏ qua lỗi khi logout
    } finally {
      apiClient.clearAccessToken();
    }
  }
};
