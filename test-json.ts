import { GoogleGenAI, Type } from '@google/genai';

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: 'hello',
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
         type: Type.OBJECT,
         properties: {
             hello: { type: Type.STRING }
         }
      }
    }
  });
  console.log('text:', response.text);
}

test().catch(console.error);
