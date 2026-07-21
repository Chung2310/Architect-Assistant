import assert from "node:assert/strict";
import { resolvePromptTemplate } from "../server/service/prompt-template.service";

const request = resolvePromptTemplate("render_tab_prompt", {
  activeSubTab: "Floorplan to 3D Floorplan",
  images: [{ data: "floorplan", mimeType: "image/png" }],
  buildingStyle: "Apartment",
  interiorStyle: "Modern",
  cameraAngleStyle: "Top-down View",
});

const systemInstruction = String(request.systemInstruction || "");
const config = request.generationConfig as Record<string, any>;
const schema = config.responseSchema as Record<string, any>;

assert.match(systemInstruction, /LAYER 1.*LOCKED INVENTORY/is);
assert.match(systemInstruction, /LAYER 2.*CONSISTENCY VERIFICATION/is);
assert.match(systemInstruction, /single most plausible interpretation/i);
assert.match(systemInstruction, /visible supporting evidence/i);
assert.match(systemInstruction, /English analytical prose/i);
assert.match(systemInstruction, /do not expose chain-of-thought/i);
assert.ok(schema.properties.optimized_english_prompt);
assert.ok(schema.required.includes("optimized_english_prompt"));
assert.match(
  schema.properties.optimized_english_prompt.description,
  /every detected room.*every detected furniture item/is,
);

const other = resolvePromptTemplate("render_tab_prompt", {
  activeSubTab: "Floorplan to 3D",
});
assert.doesNotMatch(
  String(other.systemInstruction || ""),
  /LAYER 1.*LOCKED INVENTORY/is,
);
