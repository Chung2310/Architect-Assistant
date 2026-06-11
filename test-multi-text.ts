import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function main() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: [
        {
          role: "user",
          parts: [
            { text: "SYSTEM INSTRUCTION: Just a test.\n\n" },
            { text: "And another text part." },
            { inlineData: { mimeType: "image/png", data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" } }
          ]
        }
      ],
      config: {
        imageConfig: { aspectRatio: "3:4", imageSize: "1K" } as any,
      }
    });

    console.log("Success!", response.responseId);
  } catch (error: any) {
    if (error.status === 400) {
       console.error("400 Error:", error.message);
    } else {
       console.error(error);
    }
  }
}

main();
