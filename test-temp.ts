import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function main() {
  try {
    const prompt = `<role>\nYou are an Elite Architectural Competition Board Designer...\n`;
    
    // Use a small 1x1 valid base64 png
    const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const mimeType = "image/png";

    let requestContents: any = [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ];

    let requestConfig: any = {
      temperature: 0.5,
      responseMimeType: "image/jpeg",
      imageConfig: {
        aspectRatio: "16:9",
      },
    };

    const params = {
      model: "gemini-3.1-flash-image-preview",
      contents: requestContents,
      config: requestConfig,
    };

    const {
        model,
        contents,
        systemInstruction,
        generationConfig,
        config,
        ...rest
    } = params as any;
    const combinedConfig = {
      ...(config || {}),
      ...(generationConfig || {}),
      ...(rest || {}),
    };

    const callParams = {
        model,
        contents,
        config: combinedConfig,
    } as any;

    const isNanoBanana = true;
    if (isNanoBanana) {
      delete (combinedConfig as any).responseMimeType;
      delete (combinedConfig as any).responseSchema;
    }

    console.log("Calling generateContent with", JSON.stringify(callParams, null, 2));

    const response = await ai.models.generateContent(callParams);
    console.log("Success!");
    console.log(response.candidates?.[0]?.content?.parts?.map(p => Object.keys(p)));
  } catch (error: any) {
    if (error.status === 400 || error.message?.includes('400')) {
       console.error("400 Error Message:", error.message);
    } else {
       console.error("Error toString:", error.toString());
    }
  }
}
main();
