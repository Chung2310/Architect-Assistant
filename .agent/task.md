# 📋 Danh sách Nhiệm vụ (Tasks)

- [x] Sửa phần input của Floorplan to 3D floorplan thành mặc định là Topdown view ("Top-down View") và model mặc định là "Igen gemini Image Pro Preview" ("openrouter-nano-banana-2").
- [x] Chẩn đoán nguyên nhân gốc rễ của việc build bị treo khi chạy lệnh `yarn install` (biên dịch mã nguồn C++ của thư viện `canvas`).
- [x] Kiểm tra toàn bộ backend và frontend để xác nhận xem gói npm `canvas` có được import ở đâu không (không được import ở bất kỳ đâu).
- [x] Xóa bỏ `"canvas"` khỏi danh sách dependencies trong `package.json`.
- [x] Cập nhật `yarn.lock` bằng cách chạy `yarn install` ở máy local.
- [x] Tối ưu hóa `Dockerfile` để sao chép `yarn.lock` thay vì `package-lock.json` và loại bỏ việc cài đặt các công cụ biên dịch (toolchain).
- [x] Xác minh tính đúng đắn của mã nguồn bằng cách chạy `yarn lint` và `yarn typecheck`.
- [x] Tích hợp dịch vụ PiAPI ở backend hỗ trợ cả polling ngầm và webhook callback.
- [x] Cập nhật model RenderJob lưu trữ `piapiTaskId`.
- [x] Bổ sung tài liệu Swagger đầy đủ cho endpoint Webhook của PiAPI.
- [x] Tích hợp danh sách model PiAPI trên frontend, cho phép bỏ qua kết xuất phía client để sử dụng API hàng đợi của PiAPI ở backend.
- [x] Nâng cấp `package.json` bổ sung script esbuild bundling cho server backend.
- [x] Tối ưu hóa `Dockerfile` sang luồng Multi-stage Alpine và cache mount Yarn.
- [x] Đồng bộ `.github/workflows/cd.yml` hỗ trợ cấu hình triển khai tự động VPS cho cả nhánh `develop` và `production`.
- [x] Thêm luồng tự động fallback sang PiAPI khi Gemini Native Image gặp lỗi 429 (hết hạn mức/chưa bật billing) hoặc 403/401 (không có quyền/key không hợp lệ).
- [x] Loại bỏ lớp chặn cứng (guard error) đối với các model `nano-banana-2` và `igen-image-flash` trong `piapi.service.ts` để cho phép gọi PiAPI khi xảy ra lỗi.
- [x] Khóa cơ chế nạp API Key cá nhân từ DB, bắt buộc 100% cuộc gọi sử dụng API Key trong `.env` và ngăn chặn lưu key cá nhân của user.
- [x] Định tuyến cứng mọi yêu cầu sinh ảnh Native của Gemini sang mô hình `gemini-3-pro-image` để vượt qua giới hạn bằng 0 của mô hình Flash trên tài khoản Paid Tier 1.
- [x] Cập nhật mặc định "Igen gemini Image Pro Preview" (openrouter-nano-banana-2) cho tất cả các tính năng render, upscale, enhance, sync và tiện ích khác.



