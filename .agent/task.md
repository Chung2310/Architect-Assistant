# 📋 Tasks

- [x] Diagnose root cause of hanging build at runner `yarn install` (C++ source compilation of `canvas`).
- [x] Audit backend and frontend to check if `canvas` npm package is imported (not imported anywhere).
- [x] Remove `"canvas"` from `package.json` dependencies.
- [x] Update `yarn.lock` by running `yarn install` locally.
- [x] Optimize `Dockerfile` to copy `yarn.lock` instead of `package-lock.json` and remove build toolchain installs.
- [x] Verify code correctness with `yarn lint` and `yarn typecheck`.
- [x] Tích hợp dịch vụ PiAPI ở backend hỗ trợ cả polling ngầm và webhook callback.
- [x] Cập nhật model RenderJob lưu trữ `piapiTaskId`.
- [x] Bổ sung tài liệu Swagger đầy đủ cho endpoint Webhook của PiAPI.
- [x] Tích hợp danh sách model PiAPI trên frontend, cho phép bỏ qua kết xuất phía client để sử dụng API hàng đợi của PiAPI ở backend.
- [x] Nâng cấp `package.json` bổ sung script esbuild bundling cho server backend.
- [x] Tối ưu hóa `Dockerfile` sang luồng Multi-stage Alpine và cache mount Yarn.
- [x] Đồng bộ `.github/workflows/cd.yml` hỗ trợ cấu hình triển khai tự động VPS cho cả nhánh `develop` và `production`.
