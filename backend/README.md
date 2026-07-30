# CP3 Event Assistant backend

## Phần chạy thật

- `POST /api/chat` gọi model qua OpenAI-compatible API để hiểu intent và tạo filter có schema.
- Agent gọi `search_events`, xử lý clarification, no-result, conflict và event đã hủy.
- Câu trả lời factual được dựng deterministic từ event đã qua tool; không cho model tự thêm thời gian, địa điểm hoặc deadline.
- Mỗi request lưu trace gồm model, prompt version, filter, tool, exact events, output và latency.

## Phần mock

- `data/events.json` là dữ liệu minh hoạ tự sinh, không phải dữ liệu sự kiện VLearn thật.
- Trang Thông báo, Lịch và thao tác tạo lời nhắc vẫn là frontend mock.

## Chạy local

```powershell
Copy-Item .env.example .env
# Điền MODEL_API_KEY và MODEL_BASE_URL nếu dùng OpenAI-compatible gateway.
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend dùng `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`.

## Test và eval

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe eval\run_eval.py
```

Runner tự chọn run ID mới, không ghi đè lượt cũ. Mỗi run lưu CSV, summary, golden-set snapshot, event-data snapshot và trace.

Kết quả mới nhất: `run-005`, overall 22/24 (91.7%); intent, retrieval, groundedness và behavior đạt 24/24.
