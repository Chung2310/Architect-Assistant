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
