export const authSwagger = {
  "/auth/register": {
    post: {
      tags: ["Auth"],
      summary: "Đăng ký tài khoản mới",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "password"],
              properties: {
                email: { type: "string", example: "test@example.com" },
                password: { type: "string", example: "password123" },
                displayName: { type: "string", example: "Nguyen Van A" }
              }
            }
          }
        }
      },
      responses: {
        201: { description: "Đăng ký thành công" },
        400: { description: "Yêu cầu không hợp lệ" }
      }
    }
  },
  "/auth/login": {
    post: {
      tags: ["Auth"],
      summary: "Đăng nhập bằng email/password",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "password"],
              properties: {
                email: { type: "string", example: "test@example.com" },
                password: { type: "string", example: "password123" }
              }
            }
          }
        }
      },
      responses: {
        200: { description: "Đăng nhập thành công và set httpOnly cookie" },
        401: { description: "Sai thông tin đăng nhập" }
      }
    }
  },
  "/auth/refresh-token": {
    post: {
      tags: ["Auth"],
      summary: "Lấy access token mới bằng refresh token từ cookie",
      responses: {
        200: { description: "Refresh token thành công" },
        401: { description: "Không có refresh token hoặc không hợp lệ" }
      }
    }
  },
  "/auth/me": {
    get: {
      tags: ["Auth"],
      summary: "Lấy thông tin tài khoản hiện tại",
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: "Thành công" },
        401: { description: "Chưa xác thực" }
      }
    }
  },
  "/auth/logout": {
    post: {
      tags: ["Auth"],
      summary: "Đăng xuất tài khoản (xóa cookie)",
      responses: {
        200: { description: "Đăng xuất thành công" }
      }
    }
  }
};
