import assert from "node:assert/strict";
import test from "node:test";
import { buildAIFloorPlanFilename } from "./floorPlanDownload";

test("builds a sanitized PNG filename for the active floor", () => {
  assert.equal(
    buildAIFloorPlanFilename("Nhà phố / Anh Minh", 2),
    "Nhà_phố_Anh_Minh_floor_3.png"
  );
});
