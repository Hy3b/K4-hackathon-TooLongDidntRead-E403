# Phạm vi CP3

## 1. Lát cắt duy nhất

> Sinh viên hỏi một câu về sự kiện; AI trích xuất điều kiện tìm kiếm, gọi tool lấy sự kiện từ dữ liệu có cấu trúc và trả lời kèm cảnh báo khi thông tin chưa chắc chắn.

Đây là quyết định AI trung tâm của CP3: **hiểu câu hỏi để tạo bộ lọc tìm kiếm phù hợp và chọn cách phản hồi**.

## 2. Một flow bắt buộc phải chạy thật

1. Người dùng nhập câu hỏi trên trang Trợ lý sự kiện.
2. Frontend gọi `POST /api/chat`.
3. Backend chạy LangGraph; từng node gọi model với System Prompt và chỉ node tìm kiếm được bind schema `search_events`.
4. Agent nhận diện intent và trích xuất filter.
5. Agent gọi tool `search_events`.
6. Tool đọc dữ liệu sự kiện giả từ JSON và trả kết quả có cấu trúc.
7. Agent tạo câu trả lời dựa trên tool result.
8. Frontend hiển thị câu trả lời và event card.
9. Backend lưu trace tối thiểu cho lượt chạy.

## 3. Tính năng chạy thật trong CP3

- Gửi câu hỏi từ UI tới backend.
- Nhận diện intent `search_events`.
- Trích xuất khoảng thời gian, chủ đề, chi phí và loại sự kiện.
- Tool tìm kiếm trong tập dữ liệu JSON.
- Trả tối đa 3 kết quả.
- Hỏi lại khi thiếu thông tin nghiêm trọng.
- Không bịa sự kiện khi không có kết quả.
- Cảnh báo nếu event có trạng thái `needs_confirmation`.
- Ghi trace: input, intent, filter, tool result, output, latency và model.

## 4. Phần được phép mock ở CP3

- Danh sách sự kiện dùng dữ liệu giả tự sinh.
- Nút “Tạo lời nhắc” có thể chỉ cập nhật state trên frontend.
- Trang Thông báo và Lịch có thể tiếp tục dùng mock data.
- Chưa cần crawler, scheduler và push notification.
- Chưa cần personalization thật.

UI phải ghi rõ phần mock; không mô tả chúng như chức năng backend đã hoàn thành.

## 5. Ngoài phạm vi CP3

- Đăng ký sự kiện thay người dùng.
- Đồng bộ Google Calendar.
- Crawl Facebook/Discord hoặc dữ liệu không được cấp quyền.
- Notification chạy nền thật.
- Auth và phân quyền production.
- Vector database nếu keyword/filter đã đủ.
- Multi-agent.

## 6. Definition of Done

CP3 hoàn thành khi:

- [ ] UI gửi được câu hỏi tới backend thật.
- [ ] Backend có ít nhất một lời gọi model thật.
- [ ] Agent gọi `search_events`, không trả danh sách hardcode.
- [ ] Model output được validate bằng schema.
- [ ] Không có kết quả thì trả graceful failure.
- [ ] Có trace hoặc log chứng minh model và tool đã chạy.
- [ ] Có golden set ít nhất 20 case.
- [ ] Có file kết quả của một lượt chạy toàn bộ case.
- [ ] Có tổng phần trăm đạt và danh sách case fail.
- [ ] README ghi rõ phần thật và phần mock.

## 7. Bằng chứng nên show cho TA

- Một câu hỏi live từ UI.
- Terminal hoặc trace thể hiện model call và tool call.
- Một case không có kết quả để chứng minh Agent không bịa.
- File golden set ≥20 case.
- Bảng kết quả lượt chạy đầu có phần trăm.
