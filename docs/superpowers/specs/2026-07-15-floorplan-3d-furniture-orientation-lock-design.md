# Floorplan to 3D Floorplan — Furniture Transform Lock

## Mục tiêu

Siết prompt của luồng **Floorplan to 3D Floorplan** để ảnh đầu vào là nguồn sự thật tuyệt đối cho bố trí nội thất. Mô hình chỉ được nâng cấp cách thể hiện 3D, vật liệu, màu sắc và ánh sáng; không được tự chỉnh lại bố trí vì lý do thẩm mỹ, công năng hoặc tính hợp lý.

## Phạm vi

Đồng bộ quy tắc khóa nội thất tại ba điểm đang tạo hoặc bổ sung prompt:

1. Prompt template phía server trong `server/service/prompt-template.service.ts`.
2. Chỉ thị và negative prompt cuối trong `server/controller/render-job.controller.ts`.
3. Prompt được tạo trực tiếp tại `src/components/render/RenderTabContent.tsx` và `src/components/render/FloorPlanEditor.tsx`.

Không thay đổi cấu trúc dữ liệu floorplan, thuật toán dựng Three.js, model ảnh, camera do người dùng chọn hoặc giao diện.

## Quy tắc bắt buộc

Với từng món nội thất nhìn thấy trong input, prompt cuối phải yêu cầu giữ nguyên:

- vị trí và khoảng cách tương đối;
- góc xoay và hướng quay;
- mặt trước, mặt sau, bên trái và bên phải;
- quan hệ với tường, cửa, cửa sổ và đồ vật lân cận;
- loại, số lượng, kích thước và hình dáng có thể suy ra từ input.

Nghiêm cấm dịch chuyển, xoay, đổi chiều, lật ngang, lật dọc, lật gương, hoán đổi, căn chỉnh lại, tái bố trí hoặc tối ưu bố cục. Camera hoặc phép chiếu có thể thay đổi cách người xem nhìn mô hình nhưng không được làm thay đổi transform của nội thất trong không gian mặt bằng.

Nếu một chi tiết không rõ, mô hình phải bảo toàn cách diễn giải gần input nhất và không được tự sửa theo giả định về công năng hay thẩm mỹ.

## Cách áp dụng prompt

- Bổ sung quy tắc khóa transform vào phần cleanup/layout directive dành riêng cho chế độ axonometric.
- Yêu cầu bước phân tích trung gian mô tả vị trí, góc và chiều của từng món nội thất, rồi lặp lại các ràng buộc này trong prompt render cuối.
- Bổ sung các lỗi cấm vào negative prompt: `rotated furniture`, `mirrored furniture`, `flipped orientation`, `reversed direction`, `reoriented objects`, `relocated furniture`, `rearranged furniture`, `optimized layout`.
- Giữ cùng ngữ nghĩa ở mọi entry point để prompt không bị yếu đi khi người dùng khởi tạo job từ màn hình khác nhau.
- Ưu tiên câu lệnh rõ và trực tiếp; không dựa riêng vào negative prompt.

## Kiểm chứng

Thêm hoặc cập nhật kiểm thử prompt để xác nhận chế độ **Floorplan to 3D Floorplan** luôn chứa các ràng buộc:

- giữ nguyên vị trí;
- giữ nguyên góc xoay và hướng;
- cấm lật gương hoặc đổi chiều;
- cấm tái bố trí/tối ưu nội thất;
- vẫn cho phép thay đổi vật liệu, màu sắc và chất lượng thể hiện.

Chạy kiểm thử liên quan và kiểm tra type/lint phù hợp với các file đã sửa. Việc đánh giá chất lượng ảnh thực tế là bước xác nhận bổ sung vì prompt không thể bảo đảm tuyệt đối hành vi xác suất của model ảnh.

## Tiêu chí hoàn thành

Tất cả đường tạo prompt của **Floorplan to 3D Floorplan** truyền cùng một quy tắc khóa transform nội thất, không ảnh hưởng chế độ render khác, và kiểm thử tự động xác nhận các chỉ thị bắt buộc có trong prompt cuối.
