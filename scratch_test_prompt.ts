import { resolvePromptTemplate } from "./server/service/prompt-template.service";
import { geminiService } from "./server/service/gemini.service";
import dotenv from "dotenv";
import fetch from "node-fetch";
dotenv.config();

async function run() {
  const imageUrl = "https://res.cloudinary.com/dgaofuhmv/image/upload/v1782531519/uploads/f7pdt4p5qgpe3zdqpoth.png";
  console.log("Downloading image...");
  const fetchRes = await fetch(imageUrl);
  if (!fetchRes.ok) {
    throw new Error(`Failed to download: ${fetchRes.status}`);
  }
  const arrayBuffer = await fetchRes.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = fetchRes.headers.get("content-type") || "image/png";

  console.log("Image downloaded. Base64 length:", base64.length, "Mime:", mimeType);

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
    images: [{ data: base64, mimeType }]
  });

  resolved.model = "gemini-2.5-flash";

  try {
    const res = await geminiService.generate(resolved, "");
    console.log("RAW GEMINI RESPONSE:");
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("ERROR GENERATING PROMPT:", err);
  }
}
run();
