# Floorplan 3D Furniture Orientation Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khóa tuyệt đối vị trí, góc xoay, chiều và trạng thái lật gương của nội thất trong mọi prompt thuộc luồng Floorplan to 3D Floorplan.

**Architecture:** Định nghĩa một bộ ràng buộc dùng chung trong module shared, sau đó chèn cùng nội dung vào prompt template server, chỉ thị cuối của render job và hai entry point giao diện. Kiểm thử trực tiếp module dùng chung và prompt đã resolve để ngăn các đường tạo prompt bị lệch ngữ nghĩa.

**Tech Stack:** TypeScript, React, Node.js built-in test runner, `tsx`, Joi response schema hiện có.

## Global Constraints

- Ảnh input là nguồn sự thật tuyệt đối cho transform nội thất.
- Giữ nguyên vị trí, khoảng cách tương đối, góc xoay, hướng quay, mặt trước/sau/trái/phải và quan hệ với kiến trúc.
- Cấm dịch chuyển, xoay, đổi chiều, lật ngang/dọc, lật gương, hoán đổi, căn chỉnh lại, tái bố trí và tối ưu layout.
- Chỉ được thay đổi vật liệu, màu sắc, ánh sáng và chất lượng thể hiện.
- Không thay đổi cấu trúc dữ liệu floorplan, thuật toán Three.js, model ảnh, camera hoặc giao diện.
- Không tạo commit nếu người dùng chưa cho phép.

---

### Task 1: Shared furniture-transform constraints

**Files:**
- Create: `src/shared/floorplanPromptConstraints.ts`
- Create: `src/shared/floorplanPromptConstraints.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `FLOORPLAN_FURNITURE_TRANSFORM_LOCK: string`
- Produces: `FLOORPLAN_FURNITURE_TRANSFORM_NEGATIVE: string`

- [ ] **Step 1: Add a failing test for mandatory positive and negative rules**

```ts
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
  ]) assert.match(positive, new RegExp(phrase.replaceAll("/", "\\/")));

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
  ]) assert.ok(negative.includes(phrase));
});
```

- [ ] **Step 2: Add the test script and verify the test fails**

Add to `package.json` scripts:

```json
"test": "tsx --test src/**/*.test.ts server/**/*.test.ts"
```

Run: `npm test`

Expected: FAIL because `floorplanPromptConstraints.ts` does not exist.

- [ ] **Step 3: Implement the shared constraints**

```ts
export const FLOORPLAN_FURNITURE_TRANSFORM_LOCK = [
  "FURNITURE TRANSFORM LOCK: the input floorplan is the absolute source of truth.",
  "Every furniture item must retain its exact position, relative spacing, footprint, size, shape, rotation angle, facing direction, and front/back/left/right orientation from the input.",
  "Preserve each item's exact relationship to walls, doors, windows, room boundaries, and neighboring objects.",
  "Do not move, rotate, reorient, reverse, mirror, flip horizontally, flip vertically, swap, realign, rearrange, or optimize any furniture item, even if another arrangement appears more functional or aesthetically pleasing.",
  "Camera angle and projection may change only the view of the model; they must never change any furniture transform in floorplan space.",
  "If a detail is ambiguous, preserve the interpretation closest to the input instead of inventing or correcting it.",
  "Only materials, colors, lighting, surface finishes, and render quality may change.",
].join(" ");

export const FLOORPLAN_FURNITURE_TRANSFORM_NEGATIVE = [
  "moved furniture",
  "rotated furniture",
  "mirrored furniture",
  "flipped orientation",
  "reversed direction",
  "reoriented objects",
  "relocated furniture",
  "rearranged furniture",
  "swapped furniture",
  "realigned furniture",
  "optimized layout",
].join(", ");
```

- [ ] **Step 4: Run the focused test**

Run: `npx tsx --test src/shared/floorplanPromptConstraints.test.ts`

Expected: PASS with 1 passing test.

### Task 2: Enforce the lock in server-generated prompts

**Files:**
- Modify: `server/service/prompt-template.service.ts:105-172, 352-390`
- Modify: `server/controller/render-job.controller.ts:75-110`
- Create: `server/service/prompt-template.service.test.ts`

**Interfaces:**
- Consumes: `FLOORPLAN_FURNITURE_TRANSFORM_LOCK` and `FLOORPLAN_FURNITURE_TRANSFORM_NEGATIVE` from Task 1.
- Produces: resolved `render_tab_prompt` content and final render-job prompt containing the shared constraints.

- [ ] **Step 1: Write a failing resolved-template test**

```ts
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
  assert.match(serialized, /vị trí, góc xoay, hướng quay/);
});

test("other render modes do not inherit the axonometric lock", () => {
  const resolved = resolvePromptTemplate("render_tab_prompt", {
    activeSubTab: "Render Nội Thất",
    images: [],
  });
  assert.ok(!JSON.stringify(resolved).includes(FLOORPLAN_FURNITURE_TRANSFORM_LOCK));
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx tsx --test server/service/prompt-template.service.test.ts`

Expected: first test FAIL because the shared lock is absent; isolation test PASS.

- [ ] **Step 3: Insert the shared lock into the axonometric template**

Import both shared constants. Append `FLOORPLAN_FURNITURE_TRANSFORM_LOCK` to `buildFloorplanCleanupDirective("axonometric")`, append `FLOORPLAN_FURNITURE_TRANSFORM_NEGATIVE` to `buildFloorplanNegativePrompt("axonometric")`, and add this explicit Vietnamese instruction to the axonometric `systemInstruction`:

```ts
"BẮT BUỘC phân tích và ghi rõ vị trí, góc xoay, hướng quay, mặt trước/sau/trái/phải của từng món nội thất nhìn thấy; các thuộc tính này là bất biến trong prompt render cuối.",
```

Update the response-schema descriptions so the analysis and final-prompt fields require each furniture item's position and orientation, not only room positions.

- [ ] **Step 4: Insert the shared lock into the final render-job directive**

Import both constants in `render-job.controller.ts`. For `floorplan to 3d floorplan` only, append the positive constant in `appendFloorplanCleanupDirective` and the negative constant in `appendFloorplanNegativePrompt`. Keep `floorplan to 3d` behavior unchanged.

- [ ] **Step 5: Run server prompt tests**

Run: `npx tsx --test server/service/prompt-template.service.test.ts`

Expected: PASS with 2 passing tests.

### Task 3: Enforce the same lock in client prompt entry points

**Files:**
- Modify: `src/components/render/RenderTabContent.tsx:495-530`
- Modify: `src/components/render/FloorPlanEditor.tsx:3557-3580`

**Interfaces:**
- Consumes: the two shared constants from Task 1.
- Produces: client-created prompt strings with identical transform-lock semantics.

- [ ] **Step 1: Import shared constraints in both components**

```ts
import {
  FLOORPLAN_FURNITURE_TRANSFORM_LOCK,
  FLOORPLAN_FURNITURE_TRANSFORM_NEGATIVE,
} from "../../shared/floorplanPromptConstraints";
```

Adjust the relative path if the component's existing import section resolves shared modules through a configured alias; do not introduce a new alias.

- [ ] **Step 2: Strengthen RenderTabContent's Floorplan to 3D Floorplan branch**

Add these lines after its layout rule:

```ts
- Khóa transform nội thất: ${FLOORPLAN_FURNITURE_TRANSFORM_LOCK}
- Negative prompt khóa nội thất: ${FLOORPLAN_FURNITURE_TRANSFORM_NEGATIVE}
```

The existing material/color instructions remain unchanged.

- [ ] **Step 3: Strengthen FloorPlanEditor's direct render prompt**

Add under `Strict Layout & Furniture Preservation Guidelines`:

```ts
- ${FLOORPLAN_FURNITURE_TRANSFORM_LOCK}
```

Extend its final negative prompt with:

```ts
${FLOORPLAN_FURNITURE_TRANSFORM_NEGATIVE}
```

Do not alter the non-floorplan render branch.

- [ ] **Step 4: Run static verification**

Run: `npm run typecheck`

Expected: exit code 0 with no TypeScript errors.

Run: `npm run lint`

Expected: exit code 0 with no new ESLint errors.

### Task 4: Full verification and scope review

**Files:**
- Review only: all files changed in Tasks 1-3

**Interfaces:**
- Consumes: completed shared module and all prompt integrations.
- Produces: verified implementation with no unintended changes to other render modes.

- [ ] **Step 1: Run all prompt tests**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 2: Run project verification**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run lint`

Expected: exit code 0 with no new errors.

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git diff -- src/shared/floorplanPromptConstraints.ts server/service/prompt-template.service.ts server/controller/render-job.controller.ts src/components/render/RenderTabContent.tsx src/components/render/FloorPlanEditor.tsx package.json`

Expected: changes are limited to shared constraints, their tests, and Floorplan to 3D Floorplan prompt integrations; other render behavior is unchanged.

- [ ] **Step 4: Report model-level limitation accurately**

Document in the handoff that prompt hardening strongly constrains generation but cannot mathematically guarantee a probabilistic image model's output. Recommend validating with representative floorplans containing asymmetric furniture orientations and mirrored-layout traps.
