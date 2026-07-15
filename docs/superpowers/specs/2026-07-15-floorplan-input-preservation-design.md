# Floorplan Input Preservation Design

## Mục tiêu

Tăng khả năng bám đúng bản vẽ đối với ảnh floorplan có nhiều nền trắng, nét mảnh hoặc mật độ thông tin thấp mà không ảnh hưởng các chế độ render khác.

## Thiết kế

Luồng Floorplan sẽ có bước tiền xử lý ảnh phía client trước khi gửi ảnh cho AI phân tích prompt. Thuật toán đọc luminance trên canvas, xác định bounding box của pixel đủ tối, mở rộng box bằng padding an toàn rồi crop. Nếu vùng tìm được quá nhỏ, quá thưa hoặc không đáng tin cậy, hàm trả nguyên ảnh. Ảnh không bị xoay, lật, kéo giãn hoặc thay đổi tỷ lệ.

Ảnh floorplan sau crop được resize với cạnh dài tối đa 1600 px thay vì mặc định 800 px. Các chế độ khác tiếp tục dùng hành vi hiện tại. Mức tương phản chỉ được tăng vừa phải để nét CAD rõ hơn, không làm thay đổi hình học.

Ở server, img2img strength cho job có type chứa `floorplan` giảm từ `0.85` xuống `0.35`. Masterplan không nằm trong thay đổi này. Các job không phải floorplan tiếp tục dùng `0.35`. Gemini/OpenRouter không hỗ trợ tham số strength nên chỉ nhận lợi ích từ ảnh phân tích tốt hơn và prompt chính xác hơn.

## Xử lý lỗi

Tiền xử lý là best-effort. Nếu canvas không khả dụng, ảnh không load được, không tìm thấy vùng nét đáng tin cậy hoặc crop thất bại, pipeline dùng ảnh gốc và không chặn thao tác của người dùng.

## Kiểm thử

- Kiểm thử hàm tính crop box bằng dữ liệu pixel tổng hợp: nền trắng có vùng nét lệch tâm, nét sát biên, ảnh trống và vùng nhiễu quá nhỏ.
- Kiểm thử lựa chọn cấu hình phân tích: Floorplan dùng 1600 px và crop; chế độ khác giữ 800 px và không crop.
- Kiểm thử lựa chọn img2img strength: Floorplan là 0.35, Masterplan và render thường giữ 0.35.
- Chạy test, lint, build và so sánh với baseline typecheck đã biết.

## Tiêu chí hoàn thành

Ảnh floorplan nhiều nền trắng được crop với padding mà không mất nét biên, được phân tích ở độ phân giải cao hơn, và được gửi tới PiAPI với strength 0.35. Không chế độ render nào khác thay đổi hành vi.
