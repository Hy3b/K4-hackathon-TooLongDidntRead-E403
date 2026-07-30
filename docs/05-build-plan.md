# Kế hoạch build CP3

## Mục tiêu thời gian

Kế hoạch này ưu tiên hoàn thành một flow thật trong khoảng 6–10 giờ làm việc tập trung.

## Bước 1 — Chuẩn bị dữ liệu và contract

Ước lượng: 60–90 phút.

- Tạo 20–30 event trong `events.json`.
- Có event thường, event mâu thuẫn, event đã hủy và deadline đã qua.
- Chốt Pydantic schema cho filter, event và response.
- Chốt 20 golden cases trước khi tối ưu prompt.

Kết quả:

- Tool có dữ liệu ổn định để test.
- Frontend và backend dùng cùng response contract.

## Bước 2 — Backend không AI

Ước lượng: 60–90 phút.

- Khởi tạo FastAPI.
- Tạo `/health`.
- Viết `JsonEventRepository`.
- Viết `search_events` deterministic.
- Test filter ngày, topic, cost và trạng thái.

Checkpoint nội bộ:

- Gọi tool trực tiếp trả đúng event ID cho GS-001 đến GS-008.

Không nối model nếu tool chưa đúng.

## Bước 3 — LangGraph và model call thật

Ước lượng: 2–3 giờ.

- Tạo state và structured schema.
- Viết prompt `understand_query`.
- Tạo node hỏi lại.
- Bọc `search_events` thành tool.
- Tạo node validate result.
- Tạo node compose response.
- Bật trace.

Checkpoint nội bộ:

- Một request từ terminal cho thấy model call → tool call → response.
- Case rỗng không bịa event.
- Case mâu thuẫn có warning.

## Bước 4 — Nối frontend

Ước lượng: 60–90 phút.

- Thay answer hardcode bằng fetch API.
- Thêm loading indicator.
- Disable nút gửi trong khi chờ.
- Render clarifying question.
- Render event card từ response.
- Thêm retry khi API lỗi.
- Ghi rõ trang Thông báo và Lịch vẫn là mock.

Checkpoint nội bộ:

- Flow live hoàn thành từ UI không cần sửa dữ liệu tay giữa chừng.

## Bước 5 — Eval lượt đầu

Ước lượng: 90 phút.

- Viết `run_eval.py`.
- Chạy tuần tự 20 case để tránh rate limit.
- Lưu từng trace.
- Chấm các field deterministic tự động.
- Với groundedness, so sánh claim quan trọng với event record.
- Xuất CSV và summary Markdown.

Checkpoint nội bộ:

- `run-001.csv` đủ 20 dòng kể cả case fail.
- Có phần trăm tổng.

## Bước 6 — Sửa lỗi ưu tiên cao

Ước lượng: 60 phút.

Thứ tự sửa:

1. Hallucination hoặc sai deadline/thời gian.
2. Gọi sai tool hoặc không hỏi lại.
3. Filter ngày sai timezone.
4. Event retrieval sai.
5. Câu chữ hoặc UX.

Không dành thời gian polish UI nếu golden set còn lỗi nghiêm trọng.

## Bước 7 — Chuẩn bị show CP3

Ước lượng: 30 phút.

- Chọn một happy case.
- Chọn một failure/no-result case.
- Mở trace của happy case.
- Mở bảng kết quả lượt 1.
- Ghi rõ phần mock.
- Chuẩn bị fallback nếu model API tạm lỗi: dùng trace đã lưu để giải thích, không giả là live.

## Phân công gợi ý

| Người | Phần việc |
|---|---|
| Backend | FastAPI, repository, tool và API |
| Agent | LangGraph, prompt, schema và trace |
| Frontend | Kết nối API và render response |
| Eval/Data | events.json, golden set, runner và summary |
| Product | Spec, quality bar, demo script và log quyết định |

Nếu nhóm ít người, Backend + Agent có thể gộp; Data + Eval không nên bỏ.

## Rủi ro và phương án giảm

### Model không hỗ trợ tool calling ổn định

Dùng structured output cho `understand_query`, sau đó code gọi tool. CP3 vẫn có model call thật ở quyết định trung tâm.

### Hết thời gian

Bỏ multi-turn correction, giữ happy path + clarification + no-result.

### API key hoặc mạng lỗi

Kiểm tra sớm bằng một model smoke test. Không chờ đến khi frontend hoàn thành.

### Filter thời gian sai

Truyền `current_date` cố định trong eval và timezone rõ ràng.

### Kết quả eval thấp

Ghi trung thực. Chọn sửa lỗi ảnh hưởng groundedness và hành vi trước.

## Không làm trong CP3

- Database production.
- Notification worker.
- Crawl nguồn thật.
- Đăng nhập.
- Calendar sync.
- Recommendation học từ hành vi.
- Multi-agent.
- Deploy nếu local demo đã đủ và thời gian ngắn.