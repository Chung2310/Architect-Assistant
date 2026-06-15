import express from "express";
import path from "path";
import { createServer } from "http";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import dotenv from "dotenv";
import { loggerMiddleware } from "./server/middleware/logger.middleware";
import { logger } from "./server/utils/logger";

// Load environment variables
dotenv.config();

import { connectDB } from "./server/config/database";
import { apiRouter } from "./server/router/index";
import { swaggerDocument } from "./server/swagger/index";
import { initSocket } from "./server/socket";
import { pollingService } from "./server/service/polling.service";
import { cloudinaryService } from "./server/service/cloudinary.service";
import { piapiService } from "./server/service/piapi.service";

async function startServer() {
  // Connect to database
  await connectDB();

  // Initialize background polling for PiAPI
  pollingService.init();

  const app = express();
  app.use(loggerMiddleware);

  const server = createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Initialize Socket.io
  initSocket(server);

  // Common middlewares
  app.use(cookieParser());
  
  // CORS middleware utilizing allowedOrigins from environment
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = (process.env.LINK_COR || "").split(",").map(o => o.trim());
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-User-Api-Key,x-user-api-key");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Body parser before routing
  app.use(express.json({ limit: '50mb' }));
  
  // Swagger Documentation
  app.use("/api-docs", swaggerUi.serve as unknown as express.RequestHandler, swaggerUi.setup(swaggerDocument) as unknown as express.RequestHandler);

  // Versioned API routes
  app.use("/api/v1", apiRouter);

  // Legacy health check for backwards compatibility
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy route for Gemini API
  const geminiProxy = createProxyMiddleware({
    target: "https://generativelanguage.googleapis.com",
    changeOrigin: true,
    proxyTimeout: 600000, // 10 minutes
    timeout: 600000,      // 10 minutes
    pathRewrite: async (pathStr, req) => {
      let newPath = pathStr.replace(/^\/api\/gemini-proxy/, "");
      
      const userApiKey = req.headers['x-user-api-key'] || req.headers['X-User-Api-Key'];
      const apiKey = userApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;

      if (apiKey && newPath.includes('key=')) {
        newPath = newPath.replace(/key=[^&]*/, `key=${apiKey}`);
      }
      return newPath;
    },
    on: {
      proxyReq: (proxyReq, req) => {
        const userApiKey = req.headers['x-user-api-key'] || req.headers['X-User-Api-Key'];
        const apiKey = userApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
        
        if (apiKey && !proxyReq.path.includes('key=')) {
          proxyReq.setHeader("x-goog-api-key", apiKey as string);
        }
        
        if (req.headers['x-user-api-key']) proxyReq.removeHeader('x-user-api-key');
        if (req.headers['X-User-Api-Key']) proxyReq.removeHeader('X-User-Api-Key');

        // Fix for body parser hanging issue by re-streaming the parsed body
        fixRequestBody(proxyReq, req);
      },
      error: (err, req, res) => {
        logger.error(`Gemini Proxy Error: ${err}`);
        const expressRes = res as express.Response;
        if (expressRes && !expressRes.headersSent) {
          expressRes.status(500).json({ error: "Proxy error", details: err.message });
        }
      }
    }
  });

  app.use("/api/gemini-proxy", async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const piapiKey = process.env.PIAPI_API_KEY;
    if (piapiKey && req.method === "POST") {
      try {
        const pathStr = req.path;
        const isImageModel = pathStr.includes("image-preview") || pathStr.includes("imagen") || pathStr.includes("generateImages");
        const { contents, systemInstruction, generationConfig, config: reqConfig } = req.body;

        if (isImageModel) {
          let targetModel = "nano-banana-2";
          if (pathStr.includes("gemini-3-pro-image-preview")) {
            targetModel = "nano-banana-pro";
          } else if (pathStr.includes("gemini-3.1-flash-image-preview")) {
            targetModel = "nano-banana-2";
          }
          
          let promptText = "";
          let inputImageBase64 = "";
          let inputImageMimeType = "";
          
          // Handle contents as either array or plain object with parts
          const contentsArray = Array.isArray(contents) 
            ? contents 
            : (contents && contents.parts ? [{ parts: contents.parts }] : []);
            
          for (const content of contentsArray) {
            if (content.parts && Array.isArray(content.parts)) {
              for (const part of content.parts) {
                if (part.text) {
                  promptText += part.text + "\n";
                } else if (part.inlineData && part.inlineData.data) {
                  inputImageBase64 = part.inlineData.data;
                  inputImageMimeType = part.inlineData.mimeType || "image/jpeg";
                }
              }
            }
          }
          promptText = promptText.trim();

          let aspectRatio = "1:1";
          // Support both 'generationConfig' and 'config' field names from SDK
          const mergedConfig = { ...(generationConfig || {}), ...(reqConfig || {}) };
          const imageConfig = mergedConfig?.imageConfig || {};
          if (imageConfig.aspectRatio) {
            aspectRatio = imageConfig.aspectRatio;
          }

          let uploadedImageUrl = "";
          if (inputImageBase64) {
            const fileStr = `data:${inputImageMimeType};base64,${inputImageBase64}`;
            logger.info(`[PiAPI Adapter] Uploading input image to Cloudinary for Image Generation...`);
            uploadedImageUrl = await cloudinaryService.uploadMedia(fileStr, "temp_staging");
            logger.info(`[PiAPI Adapter] Uploaded image: ${uploadedImageUrl}`);
          }

          logger.info(`[PiAPI Adapter] Generating image via PiAPI. Model: ${targetModel}, Aspect: ${aspectRatio}`);
          const piapiRes = await piapiService.generateImage(promptText, targetModel, {
            aspectRatio,
            image: uploadedImageUrl || undefined
          });
          logger.info(`[PiAPI Adapter] Image generated: ${piapiRes.url}`);

          // Fetch the generated image and convert to base64 to return in Gemini SDK format
          const imgFetchRes = await fetch(piapiRes.url);
          if (!imgFetchRes.ok) {
            throw new Error(`Failed to download generated image: ${imgFetchRes.status}`);
          }
          const arrayBuffer = await imgFetchRes.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          const mimeType = imgFetchRes.headers.get("content-type") || "image/png";

          const geminiResponse = {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        data: base64,
                        mimeType: mimeType
                      }
                    }
                  ],
                  role: "model"
                },
                finishReason: "STOP"
              }
            ]
          };

          res.json(geminiResponse);
          return;
        }
        interface OpenAIMessage {
          role: string;
          content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
        }
        const messages: OpenAIMessage[] = [];
        
        // Add system instruction if present
        let systemText = "";
        if (systemInstruction) {
          if (typeof systemInstruction === "string") {
            systemText = systemInstruction;
          } else if (systemInstruction.parts && Array.isArray(systemInstruction.parts)) {
            systemText = systemInstruction.parts.map((p: { text?: string }) => p.text).filter(Boolean).join("\n");
          } else if (systemInstruction.text) {
            systemText = systemInstruction.text;
          }
        }

        // If JSON output is requested, append the schema instruction to system instruction
        if (generationConfig?.responseMimeType === "application/json") {
          const schema = generationConfig?.responseSchema;
          let schemaPrompt = "Respond only in valid JSON format.";
          if (schema) {
            const processSchema = (s: { type?: string; properties?: Record<string, { type?: string }>; required?: string[] }): string => {
              if (s.type === "OBJECT" || s.type === "object") {
                const props = s.properties || {};
                const required = s.required || [];
                const propLines = Object.entries(props).map(([k, v]) => {
                  const reqStr = required.includes(k) ? " (required)" : "";
                  return `  "${k}": ${v.type || "string"}${reqStr}`;
                });
                return `{\n${propLines.join(",\n")}\n}`;
              }
              return `a JSON ${s.type || "object"}`;
            };
            schemaPrompt = `You MUST respond only in valid JSON format matching this schema:\n${processSchema(schema)}\nDo not include any markdown wrappers (like \`\`\`json) or additional text outside the JSON.`;
          }
          systemText = systemText ? `${systemText}\n\n${schemaPrompt}` : schemaPrompt;
        }

        if (systemText) {
          messages.push({
            role: "system",
            content: systemText
          });
        }
        
        // Add conversation messages
        if (contents && Array.isArray(contents)) {
          for (const content of contents) {
            const role = content.role === "model" ? "assistant" : "user";
            const openAiParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
            
            if (content.parts && Array.isArray(content.parts)) {
              for (const part of content.parts) {
                if (part.text) {
                  openAiParts.push({
                    type: "text",
                    text: part.text
                  });
                } else if (part.inlineData) {
                  openAiParts.push({
                    type: "image_url",
                    image_url: {
                      url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                    }
                  });
                }
              }
            }
            
            messages.push({
              role,
              content: openAiParts.length === 1 && openAiParts[0].type === "text" ? openAiParts[0].text : openAiParts
            });
          }
        }

        // Determine the target model for text generation via PiAPI
        const hasImage = messages.some((msg) => 
          Array.isArray(msg.content) && msg.content.some((part) => part.type === "image_url")
        );
        const targetModel = hasImage ? "gpt-4o" : "gpt-4o-mini";

        const piapiBody: {
          model: string;
          messages: OpenAIMessage[];
          temperature: number;
          response_format?: { type: string };
        } = {
          model: targetModel,
          messages,
          temperature: generationConfig?.temperature ?? 1.0,
        };

        if (generationConfig?.responseMimeType === "application/json") {
          piapiBody.response_format = { type: "json_object" };
        }

        logger.info(`[PiAPI Adapter] Translating Gemini request to PiAPI Chat Completion (model: ${targetModel})`);
        
        const piapiResponse = await fetch("https://api.piapi.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${piapiKey}`
          },
          body: JSON.stringify(piapiBody)
        });

        if (!piapiResponse.ok) {
          const errText = await piapiResponse.text();
          throw new Error(`PiAPI Chat Completion failed: ${piapiResponse.status} - ${errText}`);
        }

        const data = (await piapiResponse.json()) as {
          choices?: Array<{
            message?: {
              content?: string;
            };
          }>;
        };
        logger.info(`[PiAPI Adapter] Raw response from PiAPI: ${JSON.stringify(data)}`);
        const textResult = data.choices?.[0]?.message?.content || "";

        // Map response back to Gemini SDK format
        const geminiResponse = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: textResult
                  }
                ],
                role: "model"
              },
              finishReason: "STOP"
            }
          ]
        };

        res.json(geminiResponse);
      } catch (err: unknown) {
        const error = err as Error;
        logger.error(`[PiAPI Adapter] Error: ${error.message}`);
        res.status(500).json({ error: "PiAPI Adapter error", details: error.message });
      }
    } else {
      geminiProxy(req, res, next);
    }
  });

  // Proxy route to bypass CORS for images
  app.get("/api/proxy-image", async (req, res) => {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).send("Missing url parameter");
      return;
    }
    try {
      const fetchRes = await fetch(url);
      if (!fetchRes.ok) {
        // Just return the status code without logging as a server error
        res.status(fetchRes.status).send(`HTTP ${fetchRes.status}`);
        return;
      }
      const buffer = await fetchRes.arrayBuffer();
      res.setHeader("Content-Type", fetchRes.headers.get("content-type") || "application/octet-stream");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(Buffer.from(buffer));
    } catch (e) {
      // Only log actual network/parsing errors, not HTTP status errors
      res.status(500).send(String(e));
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global unhandled error handler middleware
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error(`[UNHANDLED ERROR] ${req.method} ${req.originalUrl}: ${err}`);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Đã có lỗi hệ thống xảy ra." });
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`Swagger documentation available at http://localhost:${PORT}/api-docs`);
  });
}

startServer();
