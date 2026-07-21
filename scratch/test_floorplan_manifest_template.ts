import assert from "node:assert/strict";
import { resolvePromptTemplate } from "../server/service/prompt-template.service";

const resolved = resolvePromptTemplate("render_tab_prompt", {
  activeSubTab: "Floorplan to 3D Floorplan",
  description: "Dựng đúng 1:1",
  images: [],
  referenceImages: [],
});

const serialized = JSON.stringify(resolved);
assert.match(serialized, /room_manifest/);
assert.match(serialized, /room_count_validation/);
assert.match(serialized, /room labels.*source of truth/i);
assert.match(serialized, /never split/i);
assert.match(serialized, /never merge/i);
assert.match(serialized, /never relabel/i);
assert.match(serialized, /never relocate/i);
assert.match(serialized, /exact room count/i);
assert.match(serialized, /photorealistic architectural visualization/i);
assert.match(serialized, /true-scale PBR materials/i);
assert.match(serialized, /physically plausible natural lighting/i);
assert.match(serialized, /cartoon.*dollhouse.*toy-like/i);
