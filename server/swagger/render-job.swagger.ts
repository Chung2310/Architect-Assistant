export const renderJobSwagger = {
  "/render-jobs": {
    get: {
      tags: ["Render Job"],
      summary: "Lấy danh sách render jobs của user hiện tại",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "limit", in: "query", schema: { type: "integer", default: 50 } }],
      responses: {
        200: { description: "Thành công" }
      }
    },
    post: {
      tags: ["Render Job"],
      summary: "Tạo render job mới",
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["type"],
              properties: {
                type: { type: "string", example: "render" },
                subType: { type: "string", example: "exterior" },
                inputImageUrls: { type: "array", items: { type: "string" } },
                referenceImageUrls: { type: "array", items: { type: "string" } },
                prompt: { type: "string", example: "modern villa" },
                model: { type: "string", example: "gemini" },
                resolution: { type: "string", enum: ["1K", "2K", "4K"], default: "1K" }
              }
            }
          }
        }
      },
      responses: {
        201: { description: "Tạo thành công" }
      }
    }
  },
  "/render-jobs/{id}": {
    patch: {
      tags: ["Render Job"],
      summary: "Cập nhật trạng thái/output của render job",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                status: { type: "string", enum: ["pending", "processing", "completed", "failed"] },
                outputImageUrls: { type: "array", items: { type: "string" } },
                progress: { type: "number", example: 100 }
              }
            }
          }
        }
      },
      responses: {
        200: { description: "Cập nhật thành công" }
      }
    },
    delete: {
      tags: ["Render Job"],
      summary: "Xóa render job",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        200: { description: "Xóa thành công" }
      }
    }
  },
  "/render-jobs/deduct-credits": {
    post: {
      tags: ["Render Job"],
      summary: "Trừ credits người dùng sau khi dùng AI",
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["cost"],
              properties: {
                cost: { type: "number", example: 1 },
                type: { type: "string", example: "text" },
                model: { type: "string", example: "gemini-1.5-pro" }
              }
            }
          }
        }
      },
      responses: {
        200: { description: "Trừ credits thành công" },
        402: { description: "Không đủ credits" }
      }
    }
  }
};
