import assert from "node:assert/strict";
import test from "node:test";
import {
  appendFloorplanCleanupDirective,
  appendFloorplanNegativePrompt,
} from "./render-job.controller";
import {
  FLOORPLAN_FURNITURE_TRANSFORM_LOCK,
  FLOORPLAN_FURNITURE_TRANSFORM_NEGATIVE,
} from "../../src/shared/floorplanPromptConstraints";

test("adds the furniture lock when a legacy cleanup directive already exists", () => {
  const complete = appendFloorplanCleanupDirective("Floorplan to 3D Floorplan", "prompt");
  const legacyOnly = complete.replace(` ${FLOORPLAN_FURNITURE_TRANSFORM_LOCK}`, "");
  const upgraded = appendFloorplanCleanupDirective("Floorplan to 3D Floorplan", legacyOnly);
  assert.ok(upgraded.includes(FLOORPLAN_FURNITURE_TRANSFORM_LOCK));
});

test("adds furniture negatives when a legacy negative directive already exists", () => {
  const complete = appendFloorplanNegativePrompt("Floorplan to 3D Floorplan", "prompt");
  const legacyOnly = complete.replace(`, ${FLOORPLAN_FURNITURE_TRANSFORM_NEGATIVE}`, "");
  const upgraded = appendFloorplanNegativePrompt("Floorplan to 3D Floorplan", legacyOnly);
  assert.ok(upgraded.includes(FLOORPLAN_FURNITURE_TRANSFORM_NEGATIVE));
});
