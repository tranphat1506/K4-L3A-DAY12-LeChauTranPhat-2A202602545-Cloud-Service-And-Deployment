# Phiếu Phản Ánh — K4 Level 3A, Ngày 12

> **Bài làm cá nhân.** Trả lời bằng lời của chính bạn, dựa trên những gì bạn
> quan sát được khi chạy code — không sao chép đáp án của người khác.
>
> Cách trả lời: thay dòng `` bằng câu trả lời.
> `grade.py` đếm số câu đã trả lời (15 điểm cho 10 câu).
>
> Họ và tên: ..........................  Mã học viên: ..........................

---

### Câu 1 — Fail fast (CP1)

Trong `Settings`, `agent_api_key` không có giá trị mặc định nên app chết ngay
khi khởi động nếu thiếu biến môi trường. Hãy mô tả một tình huống cụ thể mà
việc "chết sớm" này cứu bạn, so với việc để mặc định `"changeme"`.

> Tình huống triển khai lên môi trường Production thực tế nhưng quên cung cấp giá trị cho `AGENT_API_KEY`. Nếu để giá trị mặc định là `"changeme"`, ứng dụng vẫn sẽ khởi chạy bình thường và mở API công khai với một mật khẩu ai cũng biết, dẫn đến rủi ro lộ lọt dữ liệu hoặc cạn kiệt ngân sách API (bị lợi dụng request). Việc "chết sớm" (Fail Fast) giúp chặn ngay từ đầu và cảnh báo cho lập trình viên biết họ cần cấu hình bảo mật đúng đắn trước khi dịch vụ kịp nhận bất kỳ traffic nào.



---

### Câu 2 — Log cho máy đọc (CP1)

Chạy service và gọi `/ask` vài lần. Dán một dòng log JSON bạn thu được, rồi
nêu **hai** việc bạn làm được với dòng log đó mà `print("đã trả lời xong")`
không làm được.

> Dòng log: `{"event": "ask_processed", "level": "info", "timestamp": "2026-09-28T08:26:57.419482+00:00", "user": "user123", "cost": 0.002, "history_len": 4}`.
> Hai việc làm được:
> 1. Có thể dùng các công cụ giám sát (như Datadog, Kibana) để phân tích, truy vấn, và gom nhóm dữ liệu theo trường (ví dụ: đếm tổng số chi phí `cost` của user `user123` trong 1 ngày) rất dễ dàng vì định dạng là JSON có cấu trúc rõ ràng.
> 2. Dễ dàng thiết lập các cảnh báo tự động: Dựa vào timestamp hoặc số lượng event bất thường, hệ thống tự động cảnh báo có thể tự động parse dữ liệu mà không cần dùng regex phức tạp như khi parse chuỗi log text thô.



---

### Câu 3 — Kích thước image (CP2)

Build cả hai phiên bản và ghi lại số đo thật:

```bash
docker build -f <Dockerfile-1-stage> -t agent:single .
docker build -t agent:multi .
docker images | grep agent
```

| Bản | Dung lượng |
|-----|-----------|
| 1 stage (bản đầu) | ~1000 MB |
| Multi-stage | ~150 MB |

Giải thích: phần dung lượng chênh lệch đó là những gì?

> Phần dung lượng chênh lệch đó bao gồm các công cụ hỗ trợ build (như `gcc`, thư viện C/C++ build headers), cache của pip, và mã nguồn thô của các thư viện dùng để biên dịch. Multi-stage build chỉ giữ lại các thành phần thực thi đã được biên dịch xong ở stage cuối cùng (thường dùng base image `slim` cực nhẹ) và vứt bỏ hoàn toàn các file tạm thời, công cụ rác ở stage build, giúp tối ưu dung lượng image.



---

### Câu 4 — Thứ tự lệnh trong Dockerfile (CP2)

Sửa một ký tự trong `app/main.py` rồi build lại. Với Dockerfile của bạn, những
layer nào được dùng lại từ cache, layer nào phải chạy lại? Nếu bạn đặt
`COPY . .` lên trước `RUN pip install` thì kết quả khác thế nào?

> Khi sửa `app/main.py`, layer cache của việc copy file `requirements.txt` và thực thi lệnh `RUN pip install` sẽ được tái sử dụng toàn bộ (vì file `requirements.txt` không thay đổi). Các layer bị chạy lại là từ lệnh `COPY . .` trở về sau.
> Nếu đặt `COPY . .` trước `RUN pip install`, Docker sẽ vô hiệu hóa toàn bộ cache từ dòng `COPY` trở đi bất cứ khi nào CÓ BẤT CỨ file nào trong project thay đổi. Điều này dẫn đến việc Docker sẽ phải tải lại và cài đặt lại toàn bộ thư viện python thông qua `pip install` từ đầu mỗi khi bạn sửa dù chỉ 1 ký tự code, làm chậm quá trình build đi rất nhiều lần.



---

### Câu 5 — Vì sao không chạy bằng root (CP2)

Container mặc định chạy bằng root. Mô tả chuỗi sự kiện dẫn từ "một lỗ hổng
trong code Python của bạn" tới "kẻ tấn công có quyền cao trên máy host", và
lệnh `USER` cắt đứt chuỗi đó ở chỗ nào.

> Chuỗi sự kiện: Kẻ tấn công lợi dụng lỗi của ứng dụng Python (vd: RCE/Command Injection) -> Thực thi mã độc bên trong container bằng quyền user hiện tại (mặc định là root) -> Tiến hành tấn công đào thoát (container breakout) bằng cách lạm dụng các kernel namespace, cgroup cấu hình lỏng lẻo hoặc khai thác các thư mục volume mount nhạy cảm -> Chiếm được quyền root trên toàn bộ máy host thực tế.
> Lệnh `USER` cắt đứt chuỗi tấn công ngay từ bước đầu tiên: Khi đổi sang một user ảo không có đặc quyền (ví dụ `appuser`), kể cả khi kẻ tấn công khai thác được RCE trong ứng dụng Python, process độc hại đó cũng bị kìm kẹp ở quyền hạn thấp của `appuser`. Kẻ tấn công không thể cài đặt thêm rootkit, không thể tác động vào kernel, và cũng không thể thực hiện các bước đào thoát ra ngoài host.



---

### Câu 6 — Cửa sổ trượt (CP3)

Rate limit của bạn dùng sliding window 60 giây. Nếu thay bằng cách đếm theo
phút đồng hồ (reset lúc giây 00), một người dùng có thể gửi tối đa bao nhiêu
request trong 2 giây liên tiếp khi hạn mức là 10/phút? Giải thích cách đạt được
con số đó.

> Tối đa có thể gửi 20 requests trong 2 giây liên tiếp.
> Giải thích: Người dùng có thể spam 10 requests vào lúc 00:59 (giây thứ 59 của phút trước) để dùng hết hạn mức của phút đó. Chờ đúng 1 giây sau, đồng hồ chuyển sang 01:00 (bắt đầu một phút mới), hệ thống tự reset counter về 0, và người dùng lập tức gửi thêm 10 requests nữa. Kết quả là trong khung thời gian 2 giây ngắn ngủi (00:59 - 01:00) server phải gánh tới 20 requests từ cùng 1 người, vi phạm triết lý giới hạn tải thực tế của hệ thống.



---

### Câu 7 — Rate limit và cost guard (CP3)

Hai cơ chế này khác nhau ở điểm nào? Cho một tình huống mà rate limit cho qua
nhưng cost guard phải chặn, và một tình huống ngược lại.

> Sự khác biệt: Rate Limit đếm "tần suất request" trong một khung thời gian cực kỳ ngắn (ví dụ mỗi phút) để tránh Ddos làm nghẽn cổ chai server. Trong khi đó, Cost Guard đếm "giá trị tiền tệ/chi phí tích lũy" qua một thời gian rất dài (ví dụ mỗi tháng) nhằm bảo vệ ngân sách công ty.
> - Rate limit cho qua, Cost guard chặn: User thỉnh thoảng mới hỏi 1 câu (tần suất rất thưa, qua mặt rate limit) nhưng mỗi câu hỏi đều xử lý luồng prompt khổng lồ tiêu tốn quá nhiều token. Đến cuối tháng tổng bill lên mốc 10.01$ thì Cost Guard sẽ chặn request này lại vì hết ngân sách tháng.
> - Rate limit chặn, Cost guard cho qua: User spam liên tục 15 request trong vòng 10 giây. Các request đều quá nhỏ lẻ và chi phí cộng dồn chỉ tốn khoảng 0.05$ (Cost Guard vẫn cho phép vì xa mức 10$), nhưng Rate Limit lập tức đá văng 5 request cuối vì user đã vượt ngưỡng 10 requests/phút.



---

### Câu 8 — /health khác /ready (CP4)

Nếu gộp hai endpoint làm một và cho nó kiểm tra Redis, chuyện gì xảy ra với cụm
3 container khi Redis mất kết nối 30 giây? Trả lời theo đúng thứ tự sự kiện.

> 1. Khi kết nối Redis sập, kiểm tra liveness_probe (thông qua `/health` lúc này đã bị gộp với kiểm tra Redis) sẽ lập tức trả về lỗi (Unhealthy) cho cả 3 container.
> 2. Hệ thống orchestrator quản lý (Kubernetes/Docker) lầm tưởng rằng bản thân các tiến trình ứng dụng Python bên trong đang bị đứng/treo chết (deadlock), do đó nó thực hiện ra lệnh giết (kill) và restart lại toàn bộ 3 container liên tục trong suốt 30 giây.
> 3. Do 3 container bị cuốn vào vòng lặp restart/crash mù quáng, hệ thống tốn tài nguyên khởi động lại không cần thiết. Thậm chí khi Redis thực sự sống lại ở giây 31, các container có thể vẫn đang bận "khởi động lại" chưa xong nên vẫn không thể tiếp nhận user traffic ngay lập tức. (Đúng ra chỉ cần lôi khỏi Load Balancer bằng `readiness_probe` /ready là đủ để ngắt traffic tạm thời, bảo vệ tiến trình `/health` luôn sống).



---

### Câu 9 — Stateless (CP4)

Chạy `docker compose up --scale agent=3` rồi gọi `/ask` nhiều lần với cùng một
`X-User-Id`. Quan sát `history_length` trong response. Nếu lịch sử được lưu
trong một dict Python thay vì Redis, bạn sẽ thấy con số đó thay đổi thế nào?

> Nếu lưu dữ liệu vào biến dict Python (Stateful app) bên trong RAM, các request của user đi qua Load Balancer sẽ bị phân phối round-robin ngẫu nhiên tới 1 trong 3 container. Bộ nhớ RAM của container 1 không chia sẻ sang container 2 hay 3, vì vậy độ dài lịch sử (`history_length`) trả về cho frontend sẽ hiển thị chập chờn, nhảy loạn xạ (ví dụ: 1 -> 1 -> 1 -> 2 -> 2 -> 2 -> 3) tuỳ thuộc vào việc request rơi vào container nào. Nếu dùng Redis (Stateless app), bộ nhớ được tập trung về một database duy nhất bên ngoài, do đó dù user truy cập vào container nào, họ vẫn nhìn thấy một dữ liệu liền mạch duy nhất (history đều đặn tăng lên 1, 2, 3, 4).



---

### Câu 10 — Deploy thật (CP5)

Ghi lại **một** lỗi bạn gặp khi deploy lên cloud (build fail, health check
timeout, sai REDIS_URL, app không đọc `$PORT`...): thông báo lỗi là gì, bạn
tìm ra nguyên nhân bằng cách nào, và sửa ra sao?

> Lỗi gặp phải: Health check timeout trên Cloudflare tunnel (app không thể serve traffic localhost ra public).
> Thông báo lỗi: `failed to connect to localhost:8000. Connection refused.`
> Nguyên nhân: Tìm ra nguyên nhân bằng cách xem logs của container `cloudflared`. Lý do là trong mạng lưới `docker-compose`, các container không chung mạng localhost của Host machine. Vì vậy, việc trỏ tunnel về `http://localhost:8000` khiến cloudflared không tìm thấy agent container.
> Cách sửa: Trong file `docker-compose.yml`, tôi sửa flag truyền vào tunnel thành `command: tunnel --url http://agent:8000` (sử dụng đúng tên service `agent` được cấp trong mạng local nội bộ của Docker Network) để Cloudflared route đúng traffic vào API của container backend.

> *Câu trả lời của bạn*
