import { authSwagger } from "./auth.swagger";
import { userSwagger } from "./user.swagger";
import { renderJobSwagger } from "./render-job.swagger";
import { mediaSwagger } from "./media.swagger";
import { piapiSwagger } from "./piapi.swagger";

export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "iGen AI Architect Assistant API Documentation",
    version: "1.0.0",
    description: "Tài liệu API cho hệ thống iGen AI Architect Assistant",
  },
  servers: [
    {
      url: "/api/v1",
      description: "API Version 1 Endpoint",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Điền Access Token vào đây (không cần chữ Bearer)",
      },
    },
  },
  paths: {
    ...authSwagger,
    ...userSwagger,
    ...renderJobSwagger,
    ...mediaSwagger,
    ...piapiSwagger,
  },
};
