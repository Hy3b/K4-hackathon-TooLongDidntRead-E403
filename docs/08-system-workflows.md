# Workflow hệ thống CP3

## 1. Tổng quan hệ thống

Trong CP3, AI Agent và tool chạy thật nhưng nguồn sự kiện là mock dataset:

```mermaid
flowchart LR
    U["Người dùng"] --> UI["Next.js UI"]
    UI --> API["FastAPI"]
    API --> GRAPH["LangGraph Agent"]
    GRAPH --> LLM["AI Model"]
    GRAPH --> TOOL["search_events tool"]
    TOOL --> MOCK[("events.json — mock data")]
    GRAPH --> API
    API --> UI
    UI --> U
```

Phân biệt rõ:

- AI Model: chạy thật.
- LangGraph, System Prompt và Function Calling: chạy thật.
- `search_events`: chạy thật.
- `events.json`: dữ liệu giả tự sinh.
- Trang Thông báo và Lịch: vẫn có thể dùng mock UI trong CP3.

## 2. Workflow hỏi sự kiện

```mermaid
sequenceDiagram
    autonumber
    participant User as Người dùng
    participant UI as Next.js UI
    participant API as FastAPI
    participant Graph as LangGraph
    participant Model as AI Model
    participant Tool as search_events
    participant Data as events.json

    User->>UI: Nhập câu hỏi
    UI->>API: POST /api/chat
    API->>Graph: message + conversation_id + current_date
    Graph->>Model: Nhận diện intent và trích xuất filter
    Model-->>Graph: Structured intent + filters
    Graph->>Tool: search_events(filters)
    Tool->>Data: Đọc và lọc mock events
    Data-->>Tool: Event records
    Tool-->>Graph: Tool result + data_version
    Graph->>Graph: Kiểm tra rỗng, conflict và trạng thái
    Graph->>Model: Soạn câu trả lời từ tool result
    Model-->>Graph: Structured response
    Graph-->>API: answer + events + warnings
    API-->>UI: JSON response
    UI-->>User: Hiển thị chat và event cards
```

## 3. Workflow điều hướng của Agent

```mermaid
flowchart TD
    START["Nhận câu hỏi"] --> UNDERSTAND["AI phân loại intent và filter"]
    UNDERSTAND --> VALIDATE{"Thiếu thông tin bắt buộc?"}
    VALIDATE -- Có --> CLARIFY["Tạo câu hỏi làm rõ"]
    CLARIFY --> RESPONSE["Trả response"]
    VALIDATE -- Không --> SCOPE{"Intent có thuộc phạm vi?"}
    SCOPE -- Không --> REFUSE["Từ chối phần ngoài phạm vi và gợi ý bước tiếp"]
    REFUSE --> RESPONSE
    SCOPE -- Có --> SEARCH["Gọi search_events"]
    SEARCH --> TOOL_STATE{"Trạng thái tool"}
    TOOL_STATE -- Lỗi --> TOOL_ERROR["Trả lỗi tạm thời, không nói không có sự kiện"]
    TOOL_ERROR --> RESPONSE
    TOOL_STATE -- Thành công --> RESULT{"Kết quả tìm kiếm"}
    RESULT -- Rỗng --> EMPTY["Nói chưa tìm thấy và gợi ý nới điều kiện"]
    RESULT -- Có conflict --> CONFLICT["Hiển thị giá trị mâu thuẫn và cảnh báo"]
    RESULT -- Hợp lệ --> RANK["Xếp hạng tối đa 3 sự kiện"]
    EMPTY --> RESPONSE
    CONFLICT --> RESPONSE
    RANK --> COMPOSE["AI soạn câu trả lời có căn cứ"]
    COMPOSE --> RESPONSE
    RESPONSE --> END["Kết thúc lượt"]
```

## 4. Workflow hỏi lại

Ví dụ: “Có sự kiện nào hay không?”

```mermaid
sequenceDiagram
    participant U as Người dùng
    participant G as Agent
    participant M as AI Model
    participant T as Tool

    U->>G: Có sự kiện nào hay không?
    G->>M: Phân tích intent và filter
    M-->>G: intent=search_events, missing_fields=[date]
    Note over G,T: Không gọi tool khi thiếu field bắt buộc
    G-->>U: Bạn muốn tìm hôm nay, cuối tuần hay tháng này?
    U->>G: Cuối tuần này
    G->>M: Cập nhật filter từ context
    M-->>G: date_from + date_to
    G->>T: search_events(filters)
    T-->>G: Kết quả
    G-->>U: Câu trả lời + event cards
```

## 5. Workflow không có kết quả

```mermaid
flowchart LR
    A["Agent gọi search_events"] --> B["Tool trả items=[]"]
    B --> C["Agent xác nhận trạng thái no_result"]
    C --> D["Không tạo tên hoặc thông tin sự kiện"]
    D --> E["Gợi ý nới đúng một điều kiện"]
    E --> F["Trả data_mode=mock"]
```

Ví dụ phản hồi:

> Trong dữ liệu minh họa, mình chưa tìm thấy workshop blockchain miễn phí ở Đà Nẵng vào ngày mai. Bạn có muốn mở rộng sang sự kiện online không?

## 6. Workflow dữ liệu mâu thuẫn

```mermaid
flowchart TD
    A["Tool trả event"] --> B{"status = needs_confirmation?"}
    B -- Không --> C["Trả kết quả bình thường"]
    B -- Có --> D["Đọc conflicts"]
    D --> E["Hiển thị các giá trị khác nhau"]
    E --> F["Đặt confidence=low hoặc medium"]
    F --> G["Không khẳng định một giá trị là chính xác"]
    G --> H["Gợi ý xem thông tin chính thức"]
```

Trong CP3, nút tạo lời nhắc có thể vẫn là mock. Agent không được nói reminder đã được lưu ở backend nếu chức năng đó chưa được triển khai thật.

## 7. Workflow lỗi hệ thống

```mermaid
flowchart TD
    REQUEST["API nhận request"] --> MODEL{"Model hoạt động?"}
    MODEL -- Không --> MODEL_ERROR["MODEL_UNAVAILABLE"]
    MODEL -- Có --> OUTPUT{"Structured output hợp lệ?"}
    OUTPUT -- Không --> RETRY["Retry model đúng 1 lần"]
    RETRY --> OUTPUT_2{"Output hợp lệ?"}
    OUTPUT_2 -- Không --> INVALID["AGENT_OUTPUT_INVALID"]
    OUTPUT_2 -- Có --> TOOL
    OUTPUT -- Có --> TOOL{"Tool hoạt động?"}
    TOOL -- Không --> TOOL_ERROR["TOOL_UNAVAILABLE"]
    TOOL -- Có --> SUCCESS["Trả kết quả"]
```

Quy tắc:

- Tool lỗi không đồng nghĩa với không có sự kiện.
- Không dùng câu trả lời hardcode để giả một lượt AI thành công.
- Mọi lỗi trả `trace_id` để kiểm tra.
- Frontend hiển thị nút thử lại.

## 8. Workflow evaluation

```mermaid
flowchart LR
    GOLDEN["golden-set.jsonl"] --> RUNNER["run_eval.py"]
    RUNNER --> API["POST /api/chat"]
    API --> TRACE["Trace từng case"]
    API --> ACTUAL["Actual response"]
    ACTUAL --> JUDGE["Deterministic checks"]
    GOLDEN --> JUDGE
    JUDGE --> CSV["run-001.csv"]
    CSV --> SUMMARY["run-001-summary.md"]
```

Mỗi case được kiểm tra:

1. Intent.
2. Filter.
3. Tool behavior.
4. Event IDs.
5. Groundedness.
6. Expected behavior.
7. Latency.

Không xóa case fail khỏi báo cáo.

## 9. Workflow trace và quan sát

```mermaid
flowchart TD
    A["Request bắt đầu"] --> B["Sinh trace_id"]
    B --> C["Log model + prompt version"]
    C --> D["Log intent và filters"]
    D --> E["Log tool name và result count"]
    E --> F["Log response status"]
    F --> G["Log latency"]
    G --> H["Lưu JSON trace"]
```

Không lưu API key, chain-of-thought, secret trong environment hoặc dữ liệu cá nhân không cần thiết.

## 10. Trạng thái một lượt chat

```mermaid
stateDiagram-v2
    [*] --> Receiving
    Receiving --> Understanding
    Understanding --> Clarifying: thiếu thông tin
    Clarifying --> [*]
    Understanding --> Searching: đủ thông tin
    Understanding --> Refused: ngoài phạm vi
    Refused --> [*]
    Searching --> NoResult: kết quả rỗng
    Searching --> Conflict: dữ liệu mâu thuẫn
    Searching --> Composing: kết quả hợp lệ
    NoResult --> [*]
    Conflict --> [*]
    Composing --> Completed
    Completed --> [*]
    Understanding --> Failed: lỗi model
    Searching --> Failed: lỗi tool
    Failed --> [*]
```

## 11. Workflow sau CP3

Chỉ triển khai sau khi vertical slice CP3 và golden set đã ổn:

```mermaid
flowchart LR
    OFFICIAL["Nguồn sự kiện chính thức"] --> INGEST["Ingestion"]
    INGEST --> DB[("Event Database")]
    DB --> TOOL["search_events"]
    TOOL --> AGENT["LangGraph Agent"]
    DB --> SCHEDULER["Scheduler"]
    SCHEDULER --> NOTIFICATION["Notification Service"]
    NOTIFICATION --> USER["Người dùng"]
```

Khi có nguồn thật, chỉ thay repository của tool:

```text
MockJsonEventRepository
        ↓
OfficialApiEventRepository hoặc PostgresEventRepository
```

Tool contract, Agent graph, System Prompt contract và response schema nên được giữ nguyên.
