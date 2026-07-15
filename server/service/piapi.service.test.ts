import assert from "node:assert/strict";
import test from "node:test";
import { getImageToImageStrength } from "./piapi.service";

test("uses conservative img2img strength for floorplans", () => {
  assert.equal(getImageToImageStrength("Floorplan to 3D"), 0.35);
  assert.equal(getImageToImageStrength("Floorplan to 3D Floorplan"), 0.35);
});

test("preserves masterplan and normal render strengths", () => {
  assert.equal(getImageToImageStrength("Masterplan"), 0.85);
  assert.equal(getImageToImageStrength("Render Nội Thất"), 0.35);
});
