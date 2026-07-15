import assert from "node:assert/strict";
import test from "node:test";
import { resolvePromptTemplate } from "./prompt-template.service";
import { FLOORPLAN_FURNITURE_TRANSFORM_LOCK } from "../../src/shared/floorplanPromptConstraints";

test("exterior render does not inherit floorplan furniture constraints", () => {
  const resolved = resolvePromptTemplate("render_tab_prompt", {
    activeSubTab: "Render Ngoại Thất",
    images: [],
  });
  assert.ok(!JSON.stringify(resolved).includes(FLOORPLAN_FURNITURE_TRANSFORM_LOCK));
});
