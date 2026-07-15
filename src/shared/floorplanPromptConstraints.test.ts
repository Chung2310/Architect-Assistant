import assert from "node:assert/strict";
import test from "node:test";
import {
  FLOORPLAN_FURNITURE_TRANSFORM_LOCK,
  FLOORPLAN_FURNITURE_TRANSFORM_NEGATIVE,
} from "./floorplanPromptConstraints";

test("locks furniture position, orientation, handedness, and mirroring", () => {
  const positive = FLOORPLAN_FURNITURE_TRANSFORM_LOCK.toLowerCase();
  for (const phrase of [
    "exact position",
    "rotation angle",
    "front/back/left/right orientation",
    "do not mirror",
    "do not flip",
    "do not optimize",
  ]) {
    assert.ok(positive.includes(phrase), `missing positive constraint: ${phrase}`);
  }

  const negative = FLOORPLAN_FURNITURE_TRANSFORM_NEGATIVE.toLowerCase();
  for (const phrase of [
    "rotated furniture",
    "mirrored furniture",
    "flipped orientation",
    "reversed direction",
    "reoriented objects",
    "relocated furniture",
    "rearranged furniture",
    "optimized layout",
  ]) {
    assert.ok(negative.includes(phrase), `missing negative constraint: ${phrase}`);
  }
});
