# TỔNG QUAN HỆ THỐNG API VINBUS (VINBUS_CONTEXT)

Tài liệu này tổng hợp toàn bộ kiến thức, logic hoạt động và kịch bản kết nối tới hệ thống API của VinBus. Hệ thống API này chủ yếu phục vụ cho việc tra cứu tuyến đường, trạm dừng, và theo dõi xe buýt điện thời gian thực (real-time tracking).

## 1. Thông Tin Cơ Bản

- **Base URL chính thức**: `https://vbcore-api.vinbus.vn`
- **Khu vực hoạt động (Region Codes)**: Thường bao gồm Hà Nội (`hn`), TP. Hồ Chí Minh (`hcm`), và Phú Quốc (`pq`).

## 2. Cơ Chế Bảo Mật & Giải Mã (Decryption)

Đặc điểm nổi bật và quan trọng nhất của VinBus API là **toàn bộ dữ liệu phản hồi (Response) đều bị mã hóa**. 

- **Thuật toán**: AES-256-CBC
- **Secret Key (Mặc định)**: `ViNbus2o21#K3(y)th3BUSNiElectric`
- **Quy trình giải mã (Decryption Flow)**:
  1. API trả về một chuỗi JSON chứa chuỗi Hex (VD: `"1ba0bbfef22ff..."`). Cần làm sạch bằng cách loại bỏ dấu nháy kép (nếu có).
  2. Chuyển chuỗi Hex thành mảng Bytes.
  3. **16 bytes đầu tiên** của mảng được dùng làm Vector Khởi tạo (IV - Initialization Vector).
  4. **Phần còn lại** là dữ liệu mã hóa (Ciphertext).
  5. Dùng thuật toán AES với chế độ CBC và Secret Key để giải mã.
  6. Loại bỏ đệm (unpad - PKCS7) để lấy chuỗi JSON gốc cuối cùng và parse thành Object.

## 3. Luồng API (API Flow) & Kịch Bản Sử Dụng

Để xây dựng một ứng dụng "Tìm đường & Xe thời gian thực" hoàn chỉnh, quy trình gọi API sẽ diễn ra theo trình tự sau:

### Bước 1: Khởi tạo dữ liệu hệ thống
- **Endpoint**: `GET /client/route/regions`
- **Mục đích**: Lấy danh sách các mã khu vực (Region Code) và thông tin bounding box. 
- **Tham số bắt buộc**: Dùng `code` (`hn`, `pq`,...) cho các API phía sau.

- **Endpoint**: `GET /client/route/list?regionCode={regionCode}`
- **Mục đích**: Lấy danh mục tất cả tuyến xe điện VinBus đang hoạt động (ID tuyến, số hiệu tuyến, tên tuyến, giá vé, tần suất...).

### Bước 2: Tương tác người dùng & Tìm trạm
- **Endpoint**: `GET /client/station/near?lat={lat}&lng={lng}&r={radius}&regionCode={regionCode}`
- **Mục đích**: Quét các trạm xe buýt lân cận trong bán kính `r` (mét) quanh tọa độ định vị GPS của người dùng. Trả về tên trạm, tọa độ và các tuyến xe đi qua trạm đó.

### Bước 3: Xem chi tiết lộ trình
- **Endpoint**: `GET /client/route/{routeId}`
- **Mục đích**: Xem chi tiết một tuyến cụ thể.
- **Dữ liệu trả về**: Chuỗi tọa độ mã hóa Google Polyline để vẽ nét đường lên bản đồ (Map), kèm theo danh sách trạm dừng theo hai chiều đi (Outward) và về (Inward).

### Bước 4: Theo dõi thời gian thực (Real-time Tracking)
- **Endpoint**: `GET /client/vehicle/route/{routeId}?regionCode={regionCode}`
- **Mục đích**: Polling (gọi liên tục mỗi 5-10s) để cập nhật vị trí các xe đang chạy trên đường.
- **Dữ liệu trả về**: Tọa độ hiện tại, tốc độ (km/h), biển số xe, phương hướng (bearing) để tạo hiệu ứng xe di chuyển mượt mà trên bản đồ.

### Bước 5: Tra cứu xe đến trạm (ETA)
- **Endpoint**: `GET /client/station/bus_detail?regionCode={}&stationId={}&routeId={}&busId={}`
- **Mục đích**: Khi người dùng nhấn vào một trạm, hệ thống trả về thời gian chờ dự kiến (ETA - Estimated Time of Arrival). 
- **Dữ liệu trả về**: Số phút xe tới, khoảng cách còn lại.

### Bước 6: Dẫn đường (Smart Directions)
- **Endpoint**: `GET /client/direction?startLat={}&startLng={}&endLat={}&endLng={}&regionCode={}`
- **Mục đích**: Chức năng tìm đường (Routing) từ điểm A đến điểm B.
- **Dữ liệu trả về**: Lộ trình hỗn hợp, bao gồm các chặng đi bộ kết hợp với việc bắt các tuyến VinBus tối ưu nhất, cùng tổng khoảng cách và thời gian.

## 4. Những Điểm Cần Lưu Ý
- Do tính chất mã hóa, không thể xem trực tiếp kết quả API bằng Postman/Browser mà không qua tầng Middleware/Client giải mã.
- Tên tham số (params) có sự phân biệt chữ hoa, chữ thường (VD: `regionCode`, `routeId`).
- Hầu hết các response khi được giải mã thành công đều trả về danh sách đối tượng (Array of Objects) trực tiếp.
