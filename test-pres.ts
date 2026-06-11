import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function main() {
  try {
    const callParams: any = {
      model: 'gemini-3.1-flash-image-preview',
      contents: [
        {
          role: "user",
          parts: [
            { text: "Create a professional layout" },
          ]
        }
      ],
      config: {
        imageConfig: { aspectRatio: "3:4", imageSize: "1K" } as any,
      }
    };
    const response = await ai.models.generateContent(callParams);
    console.log("Success!", response.responseId);
  } catch (error: any) {
    if (error.status === 400 || error.message?.includes('400')) {
       console.error("400 Error Message:", error.message);
    } else {
       console.error("Error toString:", error.toString());
    }
  }
}

main();
