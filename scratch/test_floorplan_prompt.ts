import assert from "node:assert/strict";
import { composeRenderPrompt } from "../src/components/render/floorplanPrompt";

const analysis = {
  phan_tich_huong_ban_ve: "Bảo toàn trái-phải và trên-dưới.",
  phan_tich_phong_va_chuc_nang: "Phòng khách bên trái; phòng làm việc ở giữa-phải.",
  nhan_dien_noi_that_theo_phong: "Nội thất phải nằm trong đúng phòng.",
  room_manifest: [
    "Phòng khách | 31 m² | bên trái | giữ nguyên một phòng",
    "Phòng ngủ | 13.4 m² | giữa-trái",
    "Phòng ngủ | 13.4 m² | giữa",
    "Phòng làm việc | 11.7 m² | giữa-phải",
    "Bếp + ăn | 17.9 m² | bên phải",
    "Sân ướt | 7.6 m² | phải-trên",
    "WC | phải-dưới",
    "Phòng ngủ | 20 m² | phải-trên",
  ],
  room_count_validation: "3 phòng ngủ; 1 phòng khách; 1 phòng làm việc; 1 bếp + ăn; 1 sân ướt; 1 WC.",
  prompt_tieng_viet_toi_uu: "Dựng mặt bằng 3D chính xác.",
  prompt_phu_dinh: "sai công năng phòng",
};

const prompt = composeRenderPrompt("Floorplan to 3D Floorplan", analysis);
assert.match(prompt, /IMMUTABLE ROOM MANIFEST/);
assert.match(prompt, /Phòng khách \| 31 m² \| bên trái/);
assert.match(prompt, /Phòng làm việc \| 11.7 m² \| giữa-phải/);
assert.match(prompt, /3 phòng ngủ/);
assert.match(prompt, /Never split, merge, relabel, relocate, add, or delete any room/i);
assert.match(prompt, /do not create a fourth bedroom/i);
assert.match(prompt, /photorealistic architectural visualization/i);
assert.match(prompt, /true-scale PBR materials/i);
assert.match(prompt, /physically plausible natural lighting/i);
assert.match(prompt, /cartoon, illustration, anime, dollhouse, toy-like/i);
assert.match(prompt, /Negative prompt: sai công năng phòng/);

const otherPrompt = composeRenderPrompt("Render Nội Thất", analysis);
assert.doesNotMatch(otherPrompt, /IMMUTABLE ROOM MANIFEST/);

const bilingualAnalysis = {
  ...analysis,
  prompt_tieng_viet_toi_uu: "Vietnamese legacy prompt.",
  optimized_english_prompt:
    "A straight top-down 3D floor plan preserving the exact source orientation. The living room remains on the left with its visible sofa in the original position. No room or furniture is added, removed, split, merged, relabeled, relocated, resized, replaced, or moved.",
};

const groundedPrompt = composeRenderPrompt(
  "Floorplan to 3D Floorplan",
  bilingualAnalysis,
);
assert.match(groundedPrompt, /A straight top-down 3D floor plan/);
assert.doesNotMatch(groundedPrompt, /Vietnamese legacy prompt/);

const legacyPrompt = composeRenderPrompt("Render Nội Thất", bilingualAnalysis);
assert.match(legacyPrompt, /Vietnamese legacy prompt/);

const completeInventory = {
  ...bilingualAnalysis,
  furniture_manifest: [
    "Bedroom 1 | double bed | quantity 1 | center-left | headboard north | rectangular CAD footprint",
    "Bathroom | toilet | quantity 1 | lower-right corner | faces west | WC CAD symbol",
    "Kitchen | sink | quantity 1 | north counter | faces south | basin CAD symbol",
  ],
  furniture_count_validation:
    "Bedroom 1: 1 double bed; Bathroom: 1 toilet; Kitchen: 1 sink; grand total 3; manifest total 3; no omissions or duplicates.",
};

const inventoryPrompt = composeRenderPrompt(
  "Floorplan to 3D Floorplan",
  completeInventory,
);
assert.match(inventoryPrompt, /IMMUTABLE FURNITURE MANIFEST/);
assert.match(inventoryPrompt, /Bedroom 1 \| double bed \| quantity 1/);
assert.match(inventoryPrompt, /Bathroom \| toilet \| quantity 1/);
assert.match(inventoryPrompt, /Kitchen \| sink \| quantity 1/);
assert.match(inventoryPrompt, /EXACT FURNITURE COUNT.*grand total 3/is);
assert.match(
  inventoryPrompt,
  /Never omit, duplicate, group, replace, relocate, or rotate/i,
);

const unrelatedInventoryPrompt = composeRenderPrompt(
  "Floorplan to 3D",
  completeInventory,
);
assert.doesNotMatch(
  unrelatedInventoryPrompt,
  /IMMUTABLE FURNITURE MANIFEST/,
);
