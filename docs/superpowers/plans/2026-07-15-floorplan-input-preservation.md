# Floorplan Input Preservation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crop nền trắng và tăng độ phân giải ảnh phân tích Floorplan, đồng thời giảm riêng PiAPI floorplan img2img strength xuống 0.35.

**Architecture:** Tách thuật toán crop box thành hàm thuần có thể test, bọc xử lý canvas trong helper best-effort phía client, rồi dùng helper tại mọi đường tạo ảnh phân tích prompt. Tách lựa chọn strength thành hàm thuần phía server để giữ Floorplan 0.35, Masterplan 0.85 và render thường 0.35.

**Tech Stack:** TypeScript, browser Canvas API, Node test runner qua `tsx`, PiAPI service hiện có.

## Global Constraints

- Không xoay, lật, kéo giãn hoặc thay đổi aspect ratio của ảnh.
- Floorplan analysis dùng cạnh dài tối đa 1600 px; chế độ khác giữ 800 px.
- Crop phải có padding và fallback về ảnh gốc khi vùng nét không đáng tin cậy.
- Floorplan strength là 0.35; Masterplan giữ nguyên 0.85; job khác là 0.35.
- Không thay đổi prompt locking đã hoàn thành.
- Không commit.

---

### Task 1: Pure crop-box detection

**Files:**
- Create: `src/lib/floorplanImagePreprocessing.ts`
- Create: `src/lib/floorplanImagePreprocessing.test.ts`

**Interfaces:**
- Produces: `calculateFloorplanCropBox(pixels, width, height): CropBox | null`
- Produces: `preprocessFloorplanImageBase64(dataUrl, maxDimension?): Promise<string>`

- [ ] Viết test RED cho vùng nét lệch tâm, nét sát biên, ảnh trắng và nhiễu quá nhỏ.
- [ ] Chạy `npx tsx --test src/lib/floorplanImagePreprocessing.test.ts` và xác nhận fail vì module chưa tồn tại.
- [ ] Implement threshold luminance 225, padding 4% cạnh lớn, yêu cầu tối thiểu 32 pixel tối và vùng crop tối thiểu 10% diện tích ảnh.
- [ ] Helper canvas crop, tăng contrast bằng filter `contrast(1.15)`, resize giữ tỷ lệ với cạnh dài tối đa 1600 và fallback nguyên data URL khi lỗi.
- [ ] Chạy focused test và xác nhận pass.

### Task 2: Use high-resolution preprocessing for Floorplan prompt analysis

**Files:**
- Modify: `src/components/render/RenderTabContent.tsx`
- Test: `src/lib/floorplanImagePreprocessing.test.ts`

**Interfaces:**
- Consumes: `preprocessFloorplanImageBase64` từ Task 1.

- [ ] Thêm test cho helper cấu hình `isFloorplanAnalysisMode(activeSubTab)` nếu cần để cô lập điều kiện.
- [ ] Trong cả `getImagePart` và input/reference image map của prompt template, lấy ảnh gốc bằng `getImageBase64(url, false)`, chỉ preprocess khi active subtab là `Floorplan to 3D` hoặc `Floorplan to 3D Floorplan`; chế độ khác tiếp tục đường resize 800 hiện tại.
- [ ] Chạy focused tests và lint file liên quan.

### Task 3: Floorplan-specific img2img strength

**Files:**
- Modify: `server/service/piapi.service.ts`
- Create: `server/service/piapi.service.test.ts`

**Interfaces:**
- Produces: `getImageToImageStrength(jobType: string): number`

- [ ] Viết test RED: Floorplan variants = 0.35, Masterplan = 0.85, normal render = 0.35.
- [ ] Implement helper và dùng tại cả nano/Gemini PiAPI payload lẫn generic img2img payload.
- [ ] Chạy focused test và xác nhận pass.

### Task 4: Verification

**Files:**
- Review all changed implementation and test files.

- [ ] Chạy `npm test`.
- [ ] Chạy `npm run lint` và xác nhận không có error mới.
- [ ] Chạy `npm run build`.
- [ ] Chạy `git diff --check` và review diff chỉ tác động Floorplan như thiết kế.
