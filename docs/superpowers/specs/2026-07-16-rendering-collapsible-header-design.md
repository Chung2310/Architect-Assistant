# Thiết kế thu gọn tiêu đề và tab Rendering

## Mục tiêu

Tăng chiều cao khả dụng của workspace trên trang `/tools/rendering` bằng cách tự động ẩn hoặc hiện cụm tiêu đề Rendering và hàng tab chức năng theo hướng cuộn của người dùng.

## Phạm vi

Chức năng chỉ tác động đến phần đầu trang nằm bên trong `Render`: logo và tiêu đề “Rendering”, dòng mô tả, các liên kết mạng xã hội và hàng tab chức năng. Thanh ứng dụng toàn cục trong `Layout` — gồm logo iGen, credits, nút nạp credit và tài khoản — không thuộc phạm vi thay đổi.

## Hành vi giao diện

- Cụm tiêu đề và hàng tab được hiển thị khi trang được mở.
- Khi người dùng cuộn xuống quá ngưỡng 12px, toàn bộ cụm tiêu đề và hàng tab được thu gọn bằng chuyển động ngắn; workspace sử dụng ngay phần chiều cao được giải phóng.
- Khi người dùng cuộn lên quá ngưỡng 12px, cụm tiêu đề và hàng tab tự động xuất hiện trở lại.
- Khi vùng cuộn trở về đầu, cụm tiêu đề và hàng tab luôn được hiển thị.
- Không hiển thị nút thu gọn hoặc nút “Hiện menu”; hành vi hoàn toàn dựa trên hướng cuộn.
- Tab đang chọn, nội dung tab và trạng thái dữ liệu bên trong không bị đặt lại khi ẩn hoặc hiện menu.
- Trạng thái trở về mặc định là hiện khi trang được tải lại, component `Render` được mount lại hoặc nội dung trở về đầu. Không lưu vào local storage hoặc máy chủ.

## Responsive và tương tác cuộn

Hành vi tự động hoạt động ở mọi kích thước màn hình và dựa trên ý định cuộn từ sự kiện `wheel` và chuyển động touch, nên hỗ trợ chuột, touchpad và thao tác cuộn cảm ứng. Listener dùng capture phase tại vùng nội dung Rendering để nhận input từ các panel cuộn lồng nhau. Những thay đổi nhỏ chưa vượt ngưỡng 12px không đổi trạng thái nhằm tránh nhấp nháy. Thay đổi `scrollTop` phát sinh do layout co giãn không được dùng để quyết định hướng, tránh vòng lặp ẩn/hiện.

Thao tác cuộn trong `Render` không phát sự kiện điều khiển thanh ứng dụng toàn cục. Thanh toàn cục giữ hành vi riêng hiện có của `Layout` và nằm ngoài phạm vi chức năng này.

## Cấu trúc triển khai

- `src/components/Render.tsx` sở hữu state boolean cho trạng thái mở/thu gọn và một tracker tích lũy delta của input cuộn. Vị trí touch gần nhất được lưu riêng để chuyển chuyển động ngón tay thành delta cùng quy ước với con lăn chuột.
- Một hàm thuần nhận trạng thái cuộn trước/sau và quyết định trạng thái header để có thể kiểm thử độc lập.
- Cụm tiêu đề và tab dùng chung state này; không render bất kỳ nút điều khiển thủ công nào.
- Không tạo context hoặc state toàn cục vì trạng thái chỉ có ý nghĩa trong trang Rendering.
- Tận dụng component `Icon` và hệ thống class Tailwind hiện có; không thêm dependency.

## Khả năng truy cập

- Chuyển động ẩn/hiện giữ thời lượng ngắn theo mẫu hiện có và tôn trọng cấu hình giảm chuyển động thông qua class responsive phù hợp.
- Việc ẩn header không thay đổi focus hoặc unmount nội dung tab đang thao tác.
- Điều hướng tab bằng bàn phím tiếp tục hoạt động khi header đang hiển thị.

## Kiểm thử và tiêu chí hoàn thành

- Ban đầu tiêu đề và tab được hiển thị.
- Cuộn xuống vượt ngưỡng 12px sẽ ẩn logo, mô tả, liên kết và tab.
- Cuộn lên vượt ngưỡng 12px sẽ khôi phục đầy đủ phần đã ẩn.
- Cuộn chưa vượt ngưỡng không làm thay đổi trạng thái.
- Về đầu vùng cuộn luôn hiển thị header.
- Tab đang chọn và nội dung của nó được giữ nguyên qua chu kỳ ẩn/hiện.
- Remount hoặc tải lại trang đưa menu về trạng thái hiện.
- Hành vi giống nhau trên màn hình nhỏ và desktop, đồng thời hoạt động với vùng cuộn lồng nhau.
- Typecheck, lint liên quan và build của dự án hoàn tất không có lỗi mới.

## Ngoài phạm vi

- Ẩn thanh ứng dụng toàn cục của `Layout`.
- Lưu trạng thái thu gọn qua lần tải lại trang hoặc đồng bộ theo tài khoản.
- Thêm nút ẩn/hiện thủ công.
- Thay đổi nội dung, thứ tự hoặc quyền truy cập của các tab.
- Thiết kế lại workspace hay các panel bên trong từng tab.
