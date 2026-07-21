import assert from "node:assert/strict";
import {
  appendFloorplanCleanupDirective,
  appendFloorplanNegativePrompt,
} from "../server/controller/render-job.controller";

const type = "Floorplan to 3D Floorplan";
const cleanup = appendFloorplanCleanupDirective(type, "IMMUTABLE ROOM MANIFEST");
assert.match(cleanup, /preflight/i);
assert.match(cleanup, /exact room count/i);
assert.match(cleanup, /never split/i);
assert.match(cleanup, /never merge/i);
assert.match(cleanup, /never relabel/i);
assert.match(cleanup, /never relocate/i);
assert.match(cleanup, /read and OCR every room-name label/i);
assert.match(cleanup, /only after.*remove all visible text/i);

const negative = appendFloorplanNegativePrompt(type, cleanup);
assert.match(negative, /extra room/i);
assert.match(negative, /changed room function/i);
assert.match(negative, /do not ignore room labels during input analysis/i);
assert.match(cleanup, /true-scale PBR materials/i);
assert.match(cleanup, /physically plausible natural lighting/i);
assert.match(negative, /cartoon/i);
assert.match(negative, /dollhouse/i);
assert.match(negative, /toy-like/i);
assert.match(negative, /plastic materials/i);
