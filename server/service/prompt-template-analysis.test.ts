import assert from "node:assert/strict";
import test from "node:test";
import { resolvePromptTemplate } from "./prompt-template.service";
import { FLOORPLAN_FURNITURE_TRANSFORM_LOCK } from "../../src/shared/floorplanPromptConstraints";

test("axonometric system instruction requires per-item transform analysis", () => {
  const resolved = resolvePromptTemplate("render_tab_prompt", {
    activeSubTab: "Floorplan to 3D Floorplan",
    images: [],
  });
  const instruction = String(resolved.systemInstruction || "");
  assert.ok(instruction.includes(FLOORPLAN_FURNITURE_TRANSFORM_LOCK));
  assert.match(instruction, /analyze every furniture item/i);
  assert.match(instruction, /repeat these immutable attributes in the final render prompt/i);
});
