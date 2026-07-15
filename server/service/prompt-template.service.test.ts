import assert from "node:assert/strict";
import test from "node:test";
import { resolvePromptTemplate } from "./prompt-template.service";
import {
  FLOORPLAN_FURNITURE_TRANSFORM_LOCK,
  FLOORPLAN_FURNITURE_TRANSFORM_NEGATIVE,
} from "../../src/shared/floorplanPromptConstraints";

test("Floorplan to 3D Floorplan includes the full furniture transform lock", () => {
  const resolved = resolvePromptTemplate("render_tab_prompt", {
    activeSubTab: "Floorplan to 3D Floorplan",
    images: [],
    referenceImages: [],
  });
  const serialized = JSON.stringify(resolved);
  assert.ok(serialized.includes(FLOORPLAN_FURNITURE_TRANSFORM_LOCK));
  assert.ok(serialized.includes(FLOORPLAN_FURNITURE_TRANSFORM_NEGATIVE));
});

test("other render modes do not inherit the axonometric lock", () => {
  const resolved = resolvePromptTemplate("render_tab_prompt", {
    activeSubTab: "Render Nội Thất",
    images: [],
  });
  assert.ok(!JSON.stringify(resolved).includes(FLOORPLAN_FURNITURE_TRANSFORM_LOCK));
});
