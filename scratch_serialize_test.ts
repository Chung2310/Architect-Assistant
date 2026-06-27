import { geminiService } from "./server/service/gemini.service";
import { resolvePromptTemplate } from "./server/service/prompt-template.service";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  const resolved = resolvePromptTemplate("render_tab_prompt", {
    activeSubTab: "floorplan to 3d",
    description: "phòng ngủ hiện đại",
    style: "Phối cảnh thực tế",
    roomType: "Phòng ngủ",
    interiorStyle: "Hiện đại",
    lighting: "Ánh sáng tự nhiên",
    colorTone: "Màu sáng",
    context: "Đô thị",
    buildingStyle: "Hiện đại",
    cameraAngle: "Ngang tầm mắt",
    images: []
  });
  resolved.model = "gemini-2.5-flash";

  const response = await geminiService.generate(resolved, "");

  // Simulate how Express serializes the response
  const serialized = JSON.stringify({ success: true, data: response });
  const deserialized = JSON.parse(serialized);
  const data = deserialized.data;

  console.log("--- After Express JSON serialization ---");
  console.log("data.candidates?.length:", data.candidates?.length);
  console.log("data.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0, 100):", 
    data.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0, 100));
  console.log("typeof data.text:", typeof data.text);
  console.log("data.text (first 100 chars):", String(data.text).slice(0, 100));
  console.log("data.response:", data.response ? "exists" : "undefined");
  
  // Simulate frontend extraction
  const fullResult = data;
  const rawResponse = fullResult?.response || fullResult;
  const candidates = rawResponse?.candidates || [];
  console.log("\n--- Frontend simulation ---");
  console.log("rawResponse === fullResult:", rawResponse === fullResult);
  console.log("candidates.length:", candidates.length);
  
  let text = "";
  if (typeof rawResponse?.text === "function") {
    text = rawResponse.text();
    console.log("Extracted via function call");
  } else if (typeof rawResponse?.text === "string") {
    text = rawResponse.text;
    console.log("Extracted via string property");
  } else if (candidates && candidates[0]?.content?.parts) {
    text = candidates[0].content.parts
      .map((part: { text?: string }) => part.text || "")
      .join("");
    console.log("Extracted via candidates[0].content.parts");
  } else {
    console.log("ALL EXTRACTION METHODS FAILED - text will be empty");
  }
  
  console.log("\nFinal text (first 200 chars):", text.slice(0, 200));
}
run().catch(console.error);
