# 🌌 Các Mẫu Thiết Kế (Patterns)

## 📦 Các Mô-đun Bản Địa Trong Docker (Alpine)
- **Vấn đề**: Việc biên dịch các mô-đun bản địa (native modules - như `canvas`) từ mã nguồn trong các image Alpine bằng `node-gyp` yêu cầu tài nguyên biên dịch rất lớn (g++, make, Python) và thường xuyên bị treo hoặc hết bộ nhớ trong môi trường CI/CD hoặc các môi trường bị giới hạn tài nguyên.
- **Giải pháp**: 
  1. Kiểm tra toàn bộ mã nguồn để xem liệu gói (package) đó có thực sự được import ở phía máy chủ (backend) hay không. Nếu nó chỉ được sử dụng ở phía client (dựa trên thẻ `<canvas>` bản địa của trình duyệt), hãy xóa nó khỏi `package.json`.
  2. Nếu gói đó là bắt buộc ở backend, hãy chuyển sang một image dạng slim dựa trên Debian (ví dụ: `node:22-slim`) để có thể tải xuống các tệp nhị phân glibc đã được xây dựng sẵn thay vì phải biên dịch từ mã nguồn.

## 🔑 Sự Nhất Quán Của Yarn Lockfile Trong Docker
- **Vấn đề**: Việc chạy `yarn install` trong Docker mà không sao chép đúng tệp khóa (`yarn.lock`) sẽ khiến Yarn thực hiện việc phân giải phiên bản qua mạng một cách chậm chạp, không nhất quán và dễ bị treo.
- **Giải pháp**: Luôn luôn sao chép `yarn.lock` thay vì `package-lock.json` khi chạy các lệnh `yarn` bên trong Docker, và sử dụng cờ `--frozen-lockfile` để đảm bảo tốc độ cũng như sự nhất quán.

## 📞 Tích Hợp Bất Đồng Bộ PiAPI Với Webhook & Polling
- **Vấn đề**: Các API tạo ảnh/video từ bên thứ ba (PiAPI, Midjourney, Flux) xử lý rất chậm và mất từ 15 giây đến vài phút. Việc thực hiện polling đồng bộ trong một yêu cầu HTTP sẽ gây ra lỗi quá thời gian phản hồi của gateway (gateway timeout).
- **Giải pháp**:
  1. Kích hoạt tác vụ tạo (generation task) trên PiAPI một cách bất đồng bộ và lưu trữ ID tác vụ (`piapiTaskId`) vào cơ sở dữ liệu.
  2. Cung cấp một endpoint webhook công khai (`/api/v1/piapi/webhook`) cho môi trường production để tiếp nhận các cập nhật trạng thái tác vụ.
  3. Chạy một worker polling nhẹ nhàng (`polling.service.ts`) sử dụng `setInterval` để kiểm tra trạng thái của các tác vụ đang hoạt động, đóng vai trò dự phòng cho production và giúp việc phát triển ở môi trường local hoạt động mà không cần đến NAT tunnel.
  4. Truyền phát trực tiếp trạng thái thực tế và URL ảnh kết quả về cho client bằng WebSockets (Socket.io).

## 🐳 Docker Production Hai Giai Đoạn Với esbuild Bundling Cho Backend
- **Vấn đề**: Việc chạy trực tiếp TypeScript trong container production thông qua tsx hoặc ts-node tiêu tốn nhiều RAM, làm chậm quá trình khởi động container do phải biên dịch trực tiếp (on-the-fly), và yêu cầu phải có toàn bộ mã nguồn bên trong container chạy production.
- **Giải pháp**:
  1. Triển khai quy trình build Docker 2 giai đoạn (multi-stage build).
  2. Giai đoạn 1 (Builder): Sử dụng `esbuild` để đóng gói `server.ts` thành một mô-đun duy nhất `dist/server.cjs` với tham số `--platform=node --format=cjs --packages=external`.
  3. Giai đoạn 2 (Runner): Chỉ sao chép thư mục `dist` đã đóng gói và các file manifest của package, sau đó cài đặt các dependency chỉ dành cho production bằng cách sử dụng cơ chế yarn cache mount.
  4. Thực thi bằng node gốc: `CMD ["node", "dist/server.cjs"]`.
