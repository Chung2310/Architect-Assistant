export const userSwagger = {
  "/users": {
    get: {
      tags: ["User"],
      summary: "Lấy danh sách người dùng (Admin)",
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50 } }
      ],
      responses: {
        200: { description: "Thành công" },
        401: { description: "Chưa xác thực" },
        403: { description: "Không có quyền admin" }
      }
    }
  },
  "/users/{id}": {
    get: {
      tags: ["User"],
      summary: "Lấy thông tin chi tiết người dùng bằng ID (Admin)",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        200: { description: "Thành công" },
        404: { description: "Không tìm thấy user" }
      }
    },
    delete: {
      tags: ["User"],
      summary: "Xóa người dùng (Admin)",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        200: { description: "Xóa thành công" },
        404: { description: "Không tìm thấy user" }
      }
    }
  },
  "/users/me/api-key": {
    patch: {
      tags: ["User"],
      summary: "Cập nhật API Key của chính mình (User)",
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["apiKey"],
              properties: { apiKey: { type: "string", example: "your-gemini-key" } }
            }
          }
        }
      },
      responses: {
        200: { description: "Cập nhật thành công" }
      }
    }
  },
  "/users/{id}/role": {
    patch: {
      tags: ["User"],
      summary: "Cập nhật vai trò người dùng (Admin)",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["role"],
              properties: { role: { type: "string", enum: ["user", "admin", "superadmin"] } }
            }
          }
        }
      },
      responses: {
        200: { description: "Cập nhật thành công" }
      }
    }
  },
  "/users/{id}/credits": {
    patch: {
      tags: ["User"],
      summary: "Cập nhật credits của người dùng (Admin)",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["credits"],
              properties: { credits: { type: "number", example: 100 } }
            }
          }
        }
      },
      responses: {
        200: { description: "Cập nhật thành công" }
      }
    }
  },
  "/users/{id}/api-key": {
    patch: {
      tags: ["User"],
      summary: "Cập nhật API Key người dùng (Admin)",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["apiKey"],
              properties: { apiKey: { type: "string" } }
            }
          }
        }
      },
      responses: {
        200: { description: "Cập nhật thành công" }
      }
    }
  },
  "/users/transactions": {
    get: {
      tags: ["User"],
      summary: "Lấy tất cả các giao dịch (Admin)",
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: "Thành công" }
      }
    }
  }
};
