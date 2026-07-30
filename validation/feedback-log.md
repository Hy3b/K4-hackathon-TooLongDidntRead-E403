# Validation feedback log

> Chỉ ghi feedback từ người đã thật sự dùng prototype. Không điền thay, không tổng hợp lời khen giả. Mỗi thay đổi phải trỏ về một feedback ID hoặc ghi rõ lý do không đổi.

## Cách chạy mỗi phiên

1. Cho người thử tự nhập một câu tìm sự kiện.
2. Yêu cầu thử thêm một case khó: thiếu thời gian, không có kết quả, dữ liệu mâu thuẫn hoặc ngoài phạm vi.
3. Không giải thích trước cách hệ thống hoạt động; chỉ quan sát.
4. Hỏi ba câu:
   - Bạn nghĩ trợ lý làm được gì và không làm được gì?
   - Bạn có biết phần nào nên tin, phần nào cần kiểm tra và bước tiếp theo là gì không?
   - Chỗ nào khiến bạn do dự hoặc không hiểu?
5. Ghi quote nguyên văn ngắn, không sửa cho “hay hơn”.

## Danh sách phiên

| Session | Người thử/tên hiển thị | Vai trò | Thời điểm | Người ghi log | Evidence |
|---|---|---|---|---|---|
| V-01 | Chưa điền | Chưa điền | Chưa chạy | Chưa điền | Ảnh/video hoặc trace ID |
| V-02 | Chưa điền | Chưa điền | Chưa chạy | Chưa điền | Ảnh/video hoặc trace ID |
| V-03 | Chưa điền | Chưa điền | Chưa chạy | Chưa điền | Ảnh/video hoặc trace ID |

## Feedback nguyên tử

Mỗi dòng là một quan sát hoặc quote, không gộp nhiều vấn đề vào một dòng.

| ID | Session | Input/case | Quan sát hoặc quote nguyên văn | Mức độ | Quyết định | Owner | Trạng thái |
|---|---|---|---|---|---|---|---|
| FB-01 | V-01 | Chưa chạy | Chưa có dữ liệu thật | — | Chờ validation | Chưa điền | Chưa chạy |
| FB-02 | V-01 | Chưa chạy | Chưa có dữ liệu thật | — | Chờ validation | Chưa điền | Chưa chạy |
| FB-03 | V-02 | Chưa chạy | Chưa có dữ liệu thật | — | Chờ validation | Chưa điền | Chưa chạy |
| FB-04 | V-02 | Chưa chạy | Chưa có dữ liệu thật | — | Chờ validation | Chưa điền | Chưa chạy |
| FB-05 | V-03 | Chưa chạy | Chưa có dữ liệu thật | — | Chờ validation | Chưa điền | Chưa chạy |

Mức độ dùng một trong ba giá trị:

- `Blocker`: không hoàn thành được flow hoặc hiểu sai có hậu quả.
- `Major`: hoàn thành được nhưng cần trợ giúp hoặc mất niềm tin.
- `Minor`: vẫn hoàn thành được, chủ yếu là độ rõ/tiện dụng.

## Changelog từ validation

| Thời điểm | Feedback ID | Đổi gì hoặc giữ nguyên | Vì sao | Commit/run xác minh |
|---|---|---|---|---|
| Chưa chạy | — | Chưa có thay đổi | Chờ feedback thật | — |

## Definition of Done CP5

- [ ] Ít nhất 3 người thử có tên/vai trò.
- [ ] Ít nhất 5 feedback nguyên tử có quote hoặc quan sát cụ thể.
- [ ] Có evidence tương ứng cho từng session.
- [ ] Mọi feedback có quyết định đổi/không đổi và lý do.
- [ ] Thay đổi code/prompt được test và tạo eval run mới, không ghi đè run cũ.
- [ ] Chọn được ít nhất 2 quote thật cho slide 5.
