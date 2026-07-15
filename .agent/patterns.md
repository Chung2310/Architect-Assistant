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

## 🔒 Bảo Vệ Biến Môi Trường Nhạy Cảm Trong Frontend Builds (Vite)
- **Vấn đề**: Việc sử dụng plugin `define` của Vite hoặc `process.env` để truyền trực tiếp các khóa API nhạy cảm (như `GEMINI_API_KEY`) cho code phía client-side sẽ làm giá trị thực tế của key bị nhúng cứng (hardcoded) vào các tệp tĩnh được xuất ra ở thư mục `dist/`. Điều này gây rò rỉ bảo mật nghiêm trọng khi mã nguồn build được commit lên git hoặc deploy công khai.
- **Giải pháp**:
  1. Chỉ truyền giá trị thực tế của key nhạy cảm khi Vite chạy ở chế độ phát triển (`mode === 'development'`) để phục vụ các luồng sandbox đặc thù (như AI Studio). Ở chế độ sản xuất (`mode === 'production'`), thay thế giá trị này bằng một chuỗi rỗng `""`.
  2. Bắt buộc chuyển hướng các yêu cầu API từ client-side sang backend proxy (Server-side API) an toàn. Client gọi tới endpoint backend (như `/api/v1/gemini/generate`), backend sẽ chịu trách nhiệm đọc và chèn API key một cách an toàn từ biến môi trường phía server, đảm bảo API key không bao giờ xuất hiện ở client.

## 🔀 Tự Động Chuyển Đổi Dự Phòng Khi Hết Hạn Mức Hoặc Thiếu Quyền (API Quota & Permission Fallback)
- **Vấn đề**: Các tài khoản Google Gemini API ở Free Tier thường bị giới hạn quota bằng 0 đối với các mô-đun sinh ảnh/retouch (`gemini-3.1-flash-image` / `gemini-3-pro-image`), gây ra lỗi `429 RESOURCE_EXHAUSTED` hoặc `403/401 Forbidden` khi gọi trực tiếp từ ứng dụng.
- **Giải pháp**:
  1. Sử dụng khối lệnh `try...catch` bọc xung quanh lệnh gọi trực tiếp Google Gen AI SDK.
  2. Bắt các trạng thái lỗi cụ thể như Status `429` (Quota Limit), `403` / `401` (Unauthorized/Forbidden) hoặc các thông điệp liên quan đến `quota`, `exhausted` hay `billing`.
  3. Khi phát hiện các lỗi này, tự động điều hướng luồng xử lý sang dịch vụ thay thế (PiAPI) sử dụng `PIAPI_API_KEY` từ môi trường server.
  4. Trích xuất đúng hình ảnh đầu vào (`inlineData`) từ payload ban đầu, đưa qua Cloudinary để lấy link URL rồi chuyển tiếp cho PiAPI, đảm bảo các tính năng phức tạp như inpainting/edit vẫn hoạt động.
  5. Định hình dữ liệu phản hồi trả về bao gồm cả cấu trúc `generatedImages` và `candidates` để đảm bảo tương thích 100% với cả 2 phương án hiển thị ở client-side và lưu trữ ở controller.

