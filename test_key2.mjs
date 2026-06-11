import { GoogleGenAI } from "@google/genai";
async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: "AIzaSyC_6gfeYNu_D3Qdc6UfPT--GVMLa1c2WvA" });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Hello! If you can read this, the key works.",
    });
    console.log("Success! Response:", response.text);
  } catch (error) {
    console.error("Error:", error.message);
  }
}
test();
