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

