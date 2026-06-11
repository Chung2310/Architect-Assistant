import { GoogleGenAI } from "@google/genai";
import fetch from "node-fetch";

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: "AIzaSyBuDMbVFKk0Cb2tovzYMXP5z000P981oPI" });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [{
        role: "user",
        parts: [
          { text: "INSTRUCTION: Upscale task" },
          { text: "Upscale this image to 2K resolution." }
        ]
      }],
      config: {
        imageConfig: { aspectRatio: "1:1", imageSize: "2K" }
      }
    });

    console.log("Success!");
    console.log(response.candidates?.[0]?.content?.parts?.map(p => Object.keys(p)));
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
