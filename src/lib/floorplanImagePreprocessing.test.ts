import assert from "node:assert/strict";
import test from "node:test";
import { calculateFloorplanCropBox } from "./floorplanImagePreprocessing";

function pixels(width: number, height: number, darkPoints: Array<[number, number]>) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const [x, y] of darkPoints) {
    const offset = (y * width + x) * 4;
    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
    data[offset + 3] = 255;
  }
  return data;
}

function rectangle(x1: number, y1: number, x2: number, y2: number) {
  const points: Array<[number, number]> = [];
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) points.push([x, y]);
  }
  return points;
}

test("crops an off-center drawing with padding", () => {
  const box = calculateFloorplanCropBox(pixels(100, 100, rectangle(40, 30, 79, 69)), 100, 100);
  assert.deepEqual(box, { x: 36, y: 26, width: 48, height: 48 });
});

test("clamps padding when drawing touches image edges", () => {
  const box = calculateFloorplanCropBox(pixels(100, 100, rectangle(0, 0, 39, 39)), 100, 100);
  assert.deepEqual(box, { x: 0, y: 0, width: 44, height: 44 });
});

test("returns null for a blank image", () => {
  assert.equal(calculateFloorplanCropBox(pixels(100, 100, []), 100, 100), null);
});

test("returns null for isolated dark noise", () => {
  assert.equal(
    calculateFloorplanCropBox(pixels(100, 100, rectangle(50, 50, 54, 54)), 100, 100),
    null,
  );
});
