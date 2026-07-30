# Dữ liệu và golden set cho CP3

## 1. Dữ liệu sự kiện

CP3 nên dùng 20–30 sự kiện giả tự sinh để:

- Không phụ thuộc crawler.
- Không vi phạm bảo mật data pack.
- Chủ động tạo đủ case thường, case mâu thuẫn và case không kết quả.
- Eval lặp lại được.

File đề xuất: `backend/data/events.json`.

## 2. Event schema

```json
{
  "id": "evt_001",
  "title": "Workshop CV đầu tiên của bạn",
  "description": "Workshop hướng dẫn sinh viên chuẩn bị CV.",
  "topics": ["career", "skills"],
  "event_type": "workshop",
  "format": "offline",
  "cost": "free",
  "starts_at": "2026-08-03T18:30:00+07:00",
  "ends_at": "2026-08-03T20:00:00+07:00",
  "registration_deadline": "2026-08-02T23:59:00+07:00",
  "location": "Hội trường A",
  "organizer": "Phòng CTSV",
  "status": "published",
  "source_url": "https://example.invalid/events/evt_001",
  "updated_at": "2026-07-30T09:00:00+07:00",
  "conflicts": []
}
```

Dùng domain `.invalid` để URL minh họa không trỏ tới website thật.

## 3. Phân bố dataset

Tối thiểu:

- 6 sự kiện công nghệ.
- 5 sự kiện kỹ năng/nghề nghiệp.
- 4 hoạt động cộng đồng.
- 3 sự kiện học tập.
- 2 sự kiện online.
- 10 sự kiện miễn phí.
- 3 event `needs_confirmation`.
- 2 event `cancelled`.
- 3 deadline đã qua.
- Các ngày đủ rộng để test hôm nay, cuối tuần và tuần sau.

## 4. Golden set

File đề xuất: `backend/eval/golden-set.jsonl`.

Mỗi dòng:

```json
{
  "id": "GS-001",
  "category": "happy_path",
  "input": "Cuối tuần này có workshop công nghệ miễn phí nào không?",
  "current_date": "2026-07-30T10:00:00+07:00",
  "expected_intent": "search_events",
  "expected_filters": {
    "topics": ["technology"],
    "event_type": "workshop",
    "cost": "free"
  },
  "expected_event_ids": ["evt_002"],
  "expected_behavior": "answer_with_results",
  "forbidden_claims": []
}
```

## 5. Cơ cấu 20 case bắt buộc

| ID | Nhóm | Nội dung |
|---|---|---|
| GS-001 | Happy | Workshop công nghệ cuối tuần |
| GS-002 | Happy | Sự kiện miễn phí hôm nay |
| GS-003 | Happy | Sự kiện online tuần sau |
| GS-004 | Happy | Sự kiện của Phòng CTSV |
| GS-005 | Happy | Hoạt động cộng đồng trong tháng |
| GS-006 | Happy | Kiểm tra deadline sự kiện cụ thể |
| GS-007 | Happy | Tìm theo địa điểm |
| GS-008 | Happy | Tìm theo loại talkshow |
| GS-009 | Mơ hồ | Không có thời gian |
| GS-010 | Mơ hồ | “Gần đây” nhưng không có địa điểm |
| GS-011 | Nguồn thật | Không có kết quả, không được bịa |
| GS-012 | Nguồn thật | Event có hai giờ mâu thuẫn |
| GS-013 | Ngoài phạm vi | Yêu cầu tự đăng ký |
| GS-014 | Ngoài phạm vi | Hỏi lịch của người khác |
| GS-015 | Domain | Deadline đã qua |
| GS-016 | Domain | Event đã hủy |
| GS-017 | Correction | Đổi từ tuần này sang tuần sau |
| GS-018 | Correction | Đổi chủ đề công nghệ sang nghề nghiệp |
| GS-019 | Hiếm | Tool trả lỗi |
| GS-020 | Hiếm | Model output sai schema |

Nếu dùng data thật từ chatlog/transcript, phải tuân thủ quy định bảo mật. Với đề tài sự kiện, dùng data giả tự sinh là phù hợp và an toàn hơn.

## 6. Tiêu chí pass từng case

Một case pass khi đồng thời:

1. Intent đúng.
2. Filter bắt buộc đúng.
3. Tool được gọi hoặc không gọi đúng theo expected behavior.
4. Event ID trả về không chứa false positive nghiêm trọng.
5. Không có claim bị cấm.
6. Cảnh báo xuất hiện khi cần.
7. Structured output hợp lệ.

Không chấm bằng cảm giác “câu trả lời nghe hay”.

## 7. Chỉ số lượt chạy đầu

Bảng kết quả cần có:

- `intent_pass`
- `filter_pass`
- `tool_pass`
- `retrieval_pass`
- `groundedness_pass`
- `behavior_pass`
- `overall_pass`
- `latency_ms`
- `notes`

Tổng hợp:

```text
Overall pass rate = số case overall_pass / tổng số case
```

## 8. Quality bar gợi ý

Chốt trong `spec.md` trước hạn theo rubric. Gợi ý cho lượt đầu:

- Overall ≥ 80%.
- Intent ≥ 90%.
- Groundedness của thời gian, địa điểm và deadline = 100%.
- Không hallucination event ở case không kết quả.
- Tất cả case ngoài phạm vi đều không thực hiện hành động.

Nếu không đạt, vẫn ghi đầy đủ kết quả và phân tích nguyên nhân. Không sửa hoặc xóa case fail khỏi báo cáo.

## 9. Output của eval

```text
backend/eval/results/
├── run-001.csv
├── run-001-summary.md
└── traces/
    ├── GS-001.json
    └── ...
```

`run-001-summary.md` nên ghi:

- Model và prompt version.
- Thời điểm chạy.
- Tổng số case.
- Phần trăm đạt từng chiều.
- Danh sách case fail.
- Nguyên nhân chính.
- Thay đổi dự kiến cho lượt sau.