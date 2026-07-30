# Demo script và dry run CP5–CP6

## Kịch bản 5 phút

| Thời lượng | Slide | Người nói | Nội dung bắt buộc | Evidence |
|---:|---:|---|---|---|
| 0:00–0:45 | 1 | Chưa phân công | Sinh viên bỏ lỡ sự kiện vì thông tin phân tán; JTBD một câu | Khảo sát `n=20`, 75% bỏ lỡ, 85% quên deadline |
| 0:45–1:30 | 2 | Chưa phân công | So ba ứng viên và lý do chọn tìm sự kiện có căn cứ | Bảng impact trong `spec.md` |
| 1:30–3:30 | 3 | Chưa phân công | Demo một happy path và một case khó | Trace/API response |
| 3:30–4:15 | 4 | Chưa phân công | run-005 `91.7%` so với bar `80%`; giữ nguyên hai filter fail | CSV + summary |
| 4:15–5:00 | 5–6 | Chưa phân công | Hai quote validation thật; ba ưu tiên nếu có thêm một tuần | `validation/feedback-log.md` |

Không đọc nguyên văn toàn bộ slide. Mỗi thành viên nói ít nhất một phần.

## Case demo chính

### Happy path

Input:

```text
Cuối tuần này có sự kiện công nghệ miễn phí nào không?
```

Kỳ vọng:

- Intent `search_events`.
- Filter có topic `technology`, cost `free` và khoảng cuối tuần.
- Tool trả `evt_mock_002`.
- UI hiện event card và ghi rõ dữ liệu minh họa.

### Case khó ưu tiên

Input:

```text
Workshop Data Science ngày 4/8 diễn ra lúc nào?
```

Kỳ vọng:

- Tool trả `evt_mock_009`.
- Hệ thống cảnh báo thông tin giờ chưa được xác nhận.
- Không khẳng định một giờ duy nhất là chắc chắn.

### Case dự phòng

Input:

```text
Ngày mai có workshop blockchain miễn phí ở Đà Nẵng không?
```

Kỳ vọng: không có kết quả, không bịa tên sự kiện, gợi ý nới điều kiện.

## Phiếu dry run

| Lần | Thời điểm | Tổng thời gian | Happy path | Case khó | Backend/UI | Người bấm | Vấn đề và quyết định |
|---|---|---:|---|---|---|---|---|
| DR-01 | Chưa chạy | — | — | — | — | Chưa điền | — |
| DR-02 | Chưa chạy | — | — | — | — | Chưa điền | — |

## Checklist trước demo

- [ ] Backend và frontend chạy trên đúng URL cấu hình.
- [ ] Không chiếu `.env`, API key hoặc dữ liệu nhạy cảm.
- [ ] UI ghi rõ dữ liệu sự kiện là mock.
- [ ] Happy path và case khó đã chạy lại ngay trước giờ demo.
- [ ] Có ảnh/video backup cho cả hai case.
- [ ] Slide 5 đã thay placeholder bằng quote validation thật.
- [ ] Mỗi thành viên trả lời được: conditional automation vì sao; failure nguy hiểm nhất; phần mình làm.
