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
assert.match(systemInstruction, /PASS A.*MOVABLE FURNITURE/is);
assert.match(systemInstruction, /PASS B.*FIXED FIXTURES AND BUILT-INS/is);
assert.match(systemInstruction, /top-to-bottom.*left-to-right/is);
assert.match(systemInstruction, /classify it exactly once/is);
assert.match(
  systemInstruction,
  /toilet.*lavatory.*bathtub.*shower.*hob.*sink/is,
);
assert.match(systemInstruction, /never collapse repeated items into a set/i);
assert.ok(schema.properties.furniture_manifest);
assert.equal(schema.properties.furniture_manifest.type, "ARRAY");
assert.ok(schema.properties.furniture_count_validation);
assert.ok(schema.required.includes("furniture_manifest"));
assert.ok(schema.required.includes("furniture_count_validation"));
assert.match(
  schema.properties.furniture_manifest.description,
  /exactly one visible item.*quantity 1.*CAD evidence/is,
);
assert.match(
  schema.properties.optimized_english_prompt.description,
  /etc.*other furniture.*a dining set.*a furnished room/is,
);

const other = resolvePromptTemplate("render_tab_prompt", {
  activeSubTab: "Floorplan to 3D",
});
assert.doesNotMatch(
  String(other.systemInstruction || ""),
  /LAYER 1.*LOCKED INVENTORY/is,
);
