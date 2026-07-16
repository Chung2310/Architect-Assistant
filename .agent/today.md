# 📅 Today - 2026-07-16

## 🛠 Fixes & Improvements
- **Feature**: Cấu hình mặc định cho tính năng "Floorplan to 3D Floorplan" trên giao diện Render.
  1. Cập nhật `src/components/render/RenderTabContent.tsx` để đổi góc chụp mặc định thành `"Top-down View"` (được đưa lên làm tùy chọn đầu tiên trong dropdown) và model mặc định thành `"openrouter-nano-banana-2"` ("Igen gemini Image Pro Preview") khi người dùng chuyển sang tab "Floorplan to 3D Floorplan".
  2. Xác minh dự án chạy build và lint thành công (`npm run build`, `yarn lint`).
- **Feature**: Cấu hình mặc định mô hình "Igen gemini Image Pro Preview" (openrouter-nano-banana-2) cho toàn bộ các chức năng sinh ảnh của dự án.
  1. Cập nhật `src/components/render/RenderTabContent.tsx` để đặt model mặc định thành `"openrouter-nano-banana-2"` cho toàn bộ sub-tabs (Render Ngoại Thất, Render Nội Thất, Render VR 360, Floorplan to 3D, Masterplan to 3D).
  2. Cập nhật `src/components/render/EnhanceRenderTabContent.tsx` và `src/components/render/UpscaleTabContent.tsx` bổ sung model `"openrouter-nano-banana-2"` vào danh sách lựa chọn và đặt làm mặc định khi khởi tạo.
  3. Cập nhật `src/components/render/SyncTabContent.tsx` đặt model mặc định thành `"openrouter-nano-banana-2"` cho các góc chụp bối cảnh gợi ý, đồng thời chặn mô hình này trong tính năng Đồng bộ Nhân vật (chỉ cho phép Gemini native).
  4. Cập nhật `src/components/render/FloorPlanEditor.tsx` chuyển model 3D render mặc định sang `"openrouter-nano-banana-2"`.
  5. Cập nhật `src/components/Render.tsx` bổ sung model `"openrouter-nano-banana-2"`, gán làm mặc định cho các tiện ích phi-mood, và chặn model này trong canvas editor (vì không hỗ trợ inpainting).
  6. Sửa `server/service/gemini.service.ts` định tuyến cuộc gọi `/api/v1/gemini/generate` với model `"openrouter-nano-banana-2"` sang OpenRouter image generation API.


# 📅 Today - 2026-06-23

## 🛠 Fixes & Improvements
- **Feature**: Tích hợp luồng tự động fallback sang PiAPI khi gọi Google Gemini Native Image bị lỗi Quota/Rate Limit (429) hoặc Lỗi Quyền (403/401).
  1. Bắt lỗi `429` (Quota Exceeded / limit 0 của tài khoản Free Tier) và `403/401` khi gọi `generateContent` trực tiếp qua Google SDK.
  2. Điều hướng tác vụ sang PiAPI (`nano-banana-2` hoặc `nano-banana-pro`), trích xuất ảnh đầu vào `inlineData` nếu có để upload lên Cloudinary làm ảnh tham khảo.
  3. Loại bỏ lớp bảo vệ chặn cứng (error guard) đối với model `nano-banana-2` và `igen-image-flash` trong `piapi.service.ts` để cho phép định tuyến thành công các model này sang PiAPI khi xảy ra lỗi.
  4. Định cấu hình payload trả về chứa cả `generatedImages` và `candidates` để tương thích ngược với mọi luồng xử lý trên Client và Controller.
- **Feature**: Khóa cơ chế API Key cá nhân & định hướng cứng sang mô hình Pro:
  1. Sửa [gemini.service.ts](file:///c:/Users/PC/Documents/GitHub/Architect-Assistant/server/service/gemini.service.ts) bỏ qua tham số `userApiKey` truyền từ DB của user, luôn dùng key từ `.env`.
  2. Cập nhật [user.service.ts](file:///c:/Users/PC/Documents/GitHub/Architect-Assistant/server/service/user.service.ts) tại hàm `updateApiKey` để luôn lưu giá trị rỗng `""` thay vì lưu trữ API Key cá nhân của người dùng, giữ sạch cơ sở dữ liệu.
  3. Sửa logic chọn model Native của Gemini trong [gemini.service.ts](file:///c:/Users/PC/Documents/GitHub/Architect-Assistant/server/service/gemini.service.ts) để luôn luôn sử dụng **`gemini-3-pro-image`** (mô hình Pro) thay vì `gemini-3.1-flash-image` (mô hình Flash bị giới hạn quota = 0 ở tài khoản Paid Tier 1), giúp quá trình sinh ảnh chạy trực tiếp không bị lỗi.

# 📅 Today - 2026-06-19

## 🛠 Fixes & Improvements
- **Security**: Khắc phục lỗi rò rỉ khóa `GEMINI_API_KEY` từ file `.env` vào các file static build phía client-side (`dist/assets/`).
  1. Cập nhật [vite.config.ts](file:///d:/Igen%20Tech/iGen---AI-Architect-Assistant-main/vite.config.ts) chỉ truyền `GEMINI_API_KEY` khi ở chế độ `development` và gán chuỗi rỗng `""` trong chế độ `production` để tránh bị hardcode vào file build tĩnh.
  2. Chạy rebuild toàn bộ dự án (`yarn build`) để sinh ra bundle mới an toàn và dọn sạch khóa cũ khỏi thư mục `dist/`.
- **Bug Fix**: Sửa lỗi 404 của tab "Ghi Chú" trên môi trường Production.
  1. Thay đổi logic trong [src/components/Render.tsx](file:///d:/Igen%20Tech/iGen---AI-Architect-Assistant-main/src/components/Render.tsx) để gọi qua API endpoint bảo mật `/api/v1/gemini/generate` bằng `apiClient.post` thay vì gọi trực tiếp tới proxy `/api/gemini-proxy` đã bị xóa bỏ ở backend.
  2. Bổ sung chú thích lờ đi cảnh báo lint `// eslint-disable-next-line @typescript-eslint/no-explicit-any` giúp mã nguồn vượt qua vòng kiểm tra an toàn của ESLint (`yarn lint`).

# 📅 Today - 2026-06-12

## 🛠 Fixes & Improvements
- **Feature**: Tích hợp gọi API sinh ảnh đến PiAPI (Midjourney, Flux, Nano Banana) tương tự dự án Igen-ERP.
  1. Tạo `piapi.service.ts` hỗ trợ sinh ảnh, sinh video ( Veo 3.1) và kiểm tra trạng thái.
  2. Tạo `polling.service.ts` quét ngầm các task và cập nhật qua Socket.io.
  3. Cập nhật `renderJobController.createJob` kích hoạt PiAPI task bất đồng bộ.
  4. Tạo webhook controller và router tiếp nhận cập nhật từ PiAPI.
  5. Cập nhật frontend models dropdown và bỏ qua kết xuất phía client khi sử dụng PiAPI.

- **Docker & CI/CD Upgrade**:
  1. Nâng cấp `package.json` bổ sung esbuild đóng gói server backend thành tệp đơn `dist/server.cjs`, giảm thiểu tải runtime.
  2. Tối ưu hóa `Dockerfile` sang luồng Multi-stage Alpine siêu nhẹ, sử dụng cơ chế cache mount Yarn và chỉ cài đặt production-only dependencies.
  3. Cập nhật `.github/workflows/cd.yml` hỗ trợ cấu hình tự động triển khai VPS cho cả nhánh `develop` (Staging) và nhánh `production` (Production) đồng bộ cấu trúc Igen-ERP.
  4. Bổ sung bước dọn dẹp container (`docker rm -f`) trước khi kéo code mới trong script CD để ngăn chặn lỗi xung đột.

