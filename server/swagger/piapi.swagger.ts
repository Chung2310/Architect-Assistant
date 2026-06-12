export const piapiSwagger = {
  "/piapi/webhook": {
    post: {
      tags: ["PiAPI"],
      summary: "Webhook nhận cập nhật trạng thái từ PiAPI",
      description: "Được gọi bởi PiAPI để cập nhật trạng thái công việc kết xuất.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["task_id", "status"],
              properties: {
                task_id: { type: "string", description: "Mã định danh tác vụ PiAPI" },
                status: { 
                  type: "string", 
                  enum: ["pending", "processing", "completed", "failed"], 
                  description: "Trạng thái tác vụ" 
                },
                progress: { type: "integer", minimum: 0, maximum: 100, description: "Tiến trình kết xuất (%)" },
                output: {
                  type: "object",
                  properties: {
                    image_urls: { type: "array", items: { type: "string" }, description: "Mảng chứa liên kết hình ảnh kết quả" },
                    image_url: { type: "string" },
                    video_url: { type: "string" },
                    video: { type: "string" },
                    url: { type: "string" }
                  }
                },
                error: { type: "string", description: "Chi tiết lỗi nếu có", nullable: true }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "Nhận webhook thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true }
                }
              }
            }
          }
        },
        400: { description: "Lỗi kiểm tra dữ liệu đầu vào (Validation)" },
        500: { description: "Lỗi xử lý nội bộ của Server" }
      }
    }
  }
};
