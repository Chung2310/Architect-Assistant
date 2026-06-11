export const mediaSwagger = {
  "/media/upload": {
    post: {
      tags: ["Media"],
      summary: "Upload file lên Cloudinary",
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["file"],
              properties: {
                file: { type: "string", description: "Base64 string của file" },
                folder: { type: "string", default: "igen-architect" }
              }
            }
          }
        }
      },
      responses: {
        200: { description: "Upload thành công" }
      }
    }
  },
  "/media": {
    delete: {
      tags: ["Media"],
      summary: "Xóa file trên Cloudinary bằng public ID hoặc URL",
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["publicId"],
              properties: {
                publicId: { type: "string", example: "igen-architect/abc" }
              }
            }
          }
        }
      },
      responses: {
        200: { description: "Xóa thành công" }
      }
    }
  }
};
