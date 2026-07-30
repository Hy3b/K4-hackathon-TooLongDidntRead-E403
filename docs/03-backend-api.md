# Backend và API tối thiểu cho CP3

## 1. Mục tiêu

Backend CP3 chỉ cần hỗ trợ một vertical slice:

```text
Next.js UI → FastAPI /api/chat → LangGraph → search_events tool → events.json
```

Không cần PostgreSQL ở CP3 nếu file JSON đáp ứng demo và eval. Thiết kế repository nên cho phép đổi sang database sau mà không sửa Agent.

## 2. Stack

- Python 3.12.
- FastAPI.
- LangGraph.
- Pydantic.
- SDK model được chọn.
- Uvicorn.
- Pytest.
- HTTPX cho integration test.

## 3. Cấu trúc thư mục

```text
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── api/
│   │   └── chat.py
│   ├── agent/
│   │   ├── graph.py
│   │   ├── state.py
│   │   ├── schemas.py
│   │   ├── prompts.py
│   │   ├── nodes/
│   │   └── tools/
│   ├── events/
│   │   ├── repository.py
│   │   └── service.py
│   └── observability/
│       └── trace_store.py
├── data/
│   └── events.json
├── eval/
│   ├── golden-set.jsonl
│   ├── run_eval.py
│   └── results/
├── tests/
├── .env.example
├── pyproject.toml
└── README.md
```

## 4. API chat

### `POST /api/chat`

Request:

```json
{
  "conversation_id": "demo-session-01",
  "message": "Cuối tuần này có workshop công nghệ miễn phí nào không?"
}
```

Response thành công:

```json
{
  "conversation_id": "demo-session-01",
  "trace_id": "run_001",
  "answer": "Mình tìm thấy 1 workshop phù hợp.",
  "intent": "search_events",
  "confidence": "high",
  "clarifying_question": null,
  "events": [],
  "warnings": [],
  "suggested_actions": []
}
```

Response cần hỏi lại vẫn trả HTTP 200:

```json
{
  "answer": null,
  "intent": "search_events",
  "confidence": "low",
  "clarifying_question": "Bạn muốn tìm trong hôm nay, cuối tuần này hay tháng này?",
  "events": [],
  "warnings": [],
  "suggested_actions": []
}
```

## 5. API health

### `GET /health`

Trả trạng thái API. Không gọi model.

### `GET /ready`

Kiểm tra:

- Dataset đọc được.
- Model API key đã được cấu hình.
- Graph compile thành công.

Không trả giá trị secret.

## 6. Error contract

```json
{
  "error": {
    "code": "AGENT_UNAVAILABLE",
    "message": "Trợ lý đang tạm thời không phản hồi. Vui lòng thử lại.",
    "trace_id": "run_001"
  }
}
```

Mã lỗi CP3:

- `VALIDATION_ERROR`
- `MODEL_UNAVAILABLE`
- `TOOL_UNAVAILABLE`
- `AGENT_OUTPUT_INVALID`
- `INTERNAL_ERROR`

Không dùng lỗi tool để kết luận “không tìm thấy sự kiện”.

## 7. Event repository

Interface cần có:

```text
search(filters) -> list[Event]
get_by_id(event_id) -> Event | None
```

CP3 triển khai `JsonEventRepository`. Sau CP3 có thể thay bằng `PostgresEventRepository` mà không đổi tool contract.

## 8. CORS và cấu hình frontend

Local development:

- Frontend: `http://localhost:3000`.
- Backend: `http://localhost:8000`.
- Backend chỉ cho phép origin frontend local.
- Frontend đọc `NEXT_PUBLIC_API_BASE_URL`.

`.env.example` chỉ chứa tên biến:

```text
MODEL_API_KEY=
MODEL_NAME=
FRONTEND_ORIGIN=http://localhost:3000
EVENT_DATA_PATH=./data/events.json
TRACE_DIR=./eval/results/traces
```

Không commit API key.

## 9. Frontend cần thay đổi

- State `loading`, `error`, `messages` và `events`.
- Submit gọi `/api/chat` thay vì tính `answer` bằng `useMemo`.
- Render `clarifying_question` như tin nhắn Agent.
- Render event card từ response.
- Khi API lỗi, hiển thị retry; không dùng câu trả lời hardcode thay thế mà không ghi rõ.
- Giữ các trang Thông báo và Lịch là mock trong CP3.

## 10. Logging

Mỗi request log:

- `trace_id`
- `conversation_id`
- `intent`
- `model`
- `tool_name`
- `tool_result_count`
- `latency_ms`
- `status`

Không log API key, chain-of-thought hoặc dữ liệu cá nhân không cần thiết.

## 11. Test backend tối thiểu

Unit test:

- Filter theo ngày.
- Filter topic.
- Filter miễn phí.
- Không có kết quả.
- Event mâu thuẫn được giữ đúng status.

Integration test:

- `/health` trả 200.
- `/api/chat` validate input.
- Graph gọi tool trong happy path.
- Model output sai schema được xử lý.
- Tool lỗi trả mã lỗi đúng.