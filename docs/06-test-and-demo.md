# Kiểm thử và demo CP3

## 1. Checklist trước khi chạy eval

- [ ] `events.json` validate schema.
- [ ] Tool unit test pass.
- [ ] API key được đặt trong environment, không nằm trong repo.
- [ ] Model smoke test thành công.
- [ ] Graph compile thành công; tool schema chỉ được bind tại node tìm kiếm.
- [ ] Prompt có version, ví dụ `cp3-v1`.
- [ ] Golden set đủ ít nhất 20 case.
- [ ] `current_date` của eval được cố định.
- [ ] Thư mục kết quả chưa ghi đè lượt chạy trước.

## 2. Cách chạy lượt đánh giá

1. Khởi động backend.
2. Chạy unit test.
3. Chạy eval runner với golden set.
4. Mỗi case tạo một `trace_id` riêng.
5. Lưu raw response và kết quả chấm.
6. Xuất `run-001.csv`.
7. Tạo `run-001-summary.md`.
8. Kiểm tra tổng số dòng bằng tổng số golden case.

Không chạy lại rồi thay file `run-001`; lượt mới phải là `run-002`.

## 3. Cách chấm tự động

### Intent

So sánh `actual_intent == expected_intent`.

### Filter

Chỉ so sánh field bắt buộc khai trong case; cho phép Agent thêm field `null`.

### Tool behavior

- Happy path phải gọi `search_events`.
- Clarification không được gọi tool nếu thiếu field bắt buộc.
- Out-of-scope không gọi tool ghi dữ liệu.

### Retrieval

- Mọi `expected_event_ids` phải xuất hiện.
- Không được chứa event đã hủy trừ khi câu hỏi hỏi đúng sự kiện đó.
- Không trả event ngoài khoảng ngày bắt buộc.

### Groundedness

Các claim sau phải khớp dataset 100%:

- Tên.
- Thời gian.
- Địa điểm.
- Deadline.
- Trạng thái.

### Behavior

So sánh với một trong các nhãn:

- `answer_with_results`
- `ask_clarification`
- `no_result`
- `warn_conflict`
- `refuse_action`
- `tool_error`

## 4. Bảng summary mẫu

```markdown
# CP3 Eval Run 001

- Model: ...
- Prompt version: cp3-v1
- Tổng case: 20
- Overall: 16/20 = 80%
- Intent: 19/20 = 95%
- Filter: 17/20 = 85%
- Groundedness: 20/20 = 100%
- Behavior: 18/20 = 90%

## Case fail

| Case | Lỗi | Nguyên nhân dự kiến | Hướng sửa |
|---|---|---|---|
```

## 5. Kịch bản demo CP3 trong 3 phút

### 0:00–0:30 — Nêu lát cắt

“Người dùng hỏi sự kiện bằng ngôn ngữ tự nhiên. AI hiểu điều kiện, gọi tool tìm trong dữ liệu và trả lời có căn cứ.”

### 0:30–1:30 — Happy path live

Nhập:

> Cuối tuần này có workshop công nghệ miễn phí nào không?

Show:

- Loading.
- Câu trả lời.
- Event card.
- Warning nếu có.

### 1:30–2:00 — Chứng minh AI và tool thật

Mở trace tương ứng:

- Model name.
- Intent/filter.
- `search_events` tool call.
- Số kết quả.

Không cần show chain-of-thought.

### 2:00–2:30 — Failure path

Nhập một câu không có dữ liệu. Show Agent không bịa và gợi ý nới điều kiện.

### 2:30–3:00 — Kết quả eval

Show:

- Golden set ≥20.
- Pass rate lượt 1.
- Một case fail và nhóm học được gì.

## 6. Câu hỏi TA có thể hỏi

### “Phần nào là AI thật?”

Model thật nhận diện intent và filter, sau đó Agent điều phối tool và tổng hợp kết quả.

### “Làm sao biết không hardcode?”

Thay đổi câu hỏi/filter sẽ tạo tool arguments khác; trace lưu tool call và event ID trả về.

### “Nếu AI bịa thì sao?”

Response chỉ được phép dùng tool result; groundedness được chấm trên golden set; no-result có nhánh riêng.

### “Vì sao vẫn dùng LangGraph khi chỉ có một tool?”

LLM không được giao quyền chạy tool tự do. LangGraph chia để trị các bước hiểu câu hỏi, rẽ nhánh, Function Calling, validate và compose; conditional edges cùng backend enforce allowlist, schema và giới hạn một tool call. Cấu trúc này giúp trace và eval riêng từng quyết định.

### “Thông báo và lịch đã chạy thật chưa?”

Chưa trong CP3. Hai trang đó là mock UI; vertical slice thật nằm ở Trợ lý sự kiện.

## 7. Bằng chứng phải commit

- Backend source.
- `events.json` hoặc script sinh data giả.
- Golden set ≥20 case.
- Eval runner.
- `run-001.csv`.
- `run-001-summary.md`.
- README hướng dẫn chạy.
- `.env.example`, không có secret.

## 8. Điều kiện dừng

Không tiếp tục polish khi:

- Tool unit test chưa pass.
- Agent còn bịa event.
- Groundedness thời gian/deadline chưa đạt 100%.
- Chưa có file kết quả đầy đủ mọi case.

Ưu tiên sự đúng và bằng chứng hơn độ hoành tráng của giao diện.
