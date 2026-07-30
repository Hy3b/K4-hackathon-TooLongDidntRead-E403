# Tool sự kiện dùng dữ liệu mock

## 1. Tuyên bố rõ phạm vi

Trong CP3:

- Model AI chạy thật.
- LangGraph chạy thật.
- Agent thực sự tạo filter và gọi tool.
- Tool `search_events` chạy thật.
- Nguồn của tool là file mock `events.json`.
- Không có kết nối tới nguồn sự kiện chính thức.

Cách mô tả đúng:

> Agent chạy thật và gọi tool tìm kiếm trên bộ dữ liệu sự kiện minh họa.

Không nên nói Agent đang lấy sự kiện thật từ VLearn hoặc từ các đơn vị trong trường.

## 2. Vì sao dùng mock data?

- Chưa có API hoặc nguồn sự kiện chính thức.
- Không nên tự crawl mạng xã hội khi chưa có quyền.
- Dữ liệu mock giúp test lặp lại được.
- Nhóm chủ động tạo đủ case mâu thuẫn, hết hạn, hủy và không có kết quả.
- Phù hợp quy định đề bài cho phép dùng dữ liệu giả tự sinh.

## 3. Tool chạy thật nghĩa là gì?

Khi Agent gọi:

```json
{
  "name": "search_events",
  "arguments": {
    "topics": ["technology"],
    "event_type": "workshop",
    "cost": "free"
  }
}
```

backend thực sự:

1. Validate arguments.
2. Đọc `events.json`.
3. Lọc theo ngày, topic, cost và trạng thái.
4. Sắp xếp kết quả.
5. Trả event records cho Agent.

Danh sách trả về không được viết sẵn trong prompt hoặc trong component frontend.

## 4. Cấu trúc mock source

```text
backend/data/
├── events.json
├── README.md
└── data-version.txt
```

`backend/data/README.md` cần ghi dữ liệu tự sinh cho hackathon, không đại diện cho sự kiện thật, ngày tạo, schema version và các case được cố ý đưa vào.

## 5. Quy tắc tạo mock event

- Không dùng tên hoặc thông tin cá nhân thật.
- Có thể dùng tên đơn vị chung như “Phòng CTSV”.
- URL dùng domain `example.invalid`.
- Tên sự kiện đủ thực tế để demo nhưng không ngụ ý đang diễn ra thật.
- Mỗi event có `is_mock: true`.
- Mỗi response API có `data_mode: "mock"`.
- Mỗi tool result có `data_version`.

Ví dụ:

```json
{
  "id": "evt_mock_001",
  "is_mock": true,
  "title": "Tech Talk: Từ ý tưởng đến MVP",
  "topics": ["technology"],
  "starts_at": "2026-08-07T15:00:00+07:00",
  "status": "needs_confirmation",
  "source_url": "https://example.invalid/events/evt_mock_001"
}
```

## 6. API response

Response nên có:

```json
{
  "data_mode": "mock",
  "data_version": "cp3-seed-v1",
  "answer": "Trong dữ liệu minh họa, mình tìm thấy 1 sự kiện phù hợp.",
  "events": []
}
```

Frontend hiển thị một dòng cố định:

> Dữ liệu sự kiện đang dùng cho bản thử nghiệm.

Không cần lặp lại chữ “mock” trong mọi event card nếu đã có nhãn rõ trên khu vực chat.

## 7. Eval tool riêng và eval Agent

### Tool eval

- Cùng input luôn trả cùng event IDs.
- Filter ngày chính xác.
- Không trả event `cancelled` trong search thông thường.
- Không trả event ngoài thời gian.
- Giữ warning của event `needs_confirmation`.

### Agent eval

- Agent tạo đúng arguments.
- Agent dùng đúng event records.
- Agent không biến mock data thành tuyên bố sự kiện thật.
- Agent trả no-result khi tool trả rỗng.

Nếu tool sai thì không dùng lỗi đó để đánh giá prompt.

## 8. Trace demo

```json
{
  "data_mode": "mock",
  "data_version": "cp3-seed-v1",
  "model_called": true,
  "tool_called": "search_events",
  "tool_result_count": 1
}
```

Trace giúp chứng minh câu trả lời không hardcode, AI và tool có chạy thật, còn nguồn sự kiện vẫn là mock.

## 9. Đường nâng cấp sau CP3

Giữ nguyên tool contract và thay implementation khi có nguồn chính thức:

```text
MockJsonEventRepository
        ↓
OfficialApiEventRepository hoặc PostgresEventRepository
```

Agent và frontend không cần thay đổi lớn nếu response schema được giữ ổn định.