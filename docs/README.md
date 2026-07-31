# Tài liệu triển khai CP3 — VLearn Event AI

Bộ tài liệu này chỉ phục vụ mục tiêu checkpoint 3: biến UI mock thành một vertical slice có backend và AI chạy thật.

## CP3 cần chứng minh

1. Có ít nhất một lời gọi AI thật tại quyết định trung tâm.
2. AI hiểu câu hỏi và quyết định cách tìm sự kiện.
3. Kết quả sự kiện đến từ tool/backend, không hardcode trong câu trả lời.
4. Có golden set tối thiểu 20 case.
5. Chạy toàn bộ golden set ít nhất một lượt và ghi kết quả trung thực bằng phần trăm.
6. Phần nào còn mock phải ghi rõ.

## Thứ tự đọc

1. [00-cp3-scope.md](00-cp3-scope.md) — phạm vi và tiêu chí hoàn thành CP3.
2. [01-features-and-flows.md](01-features-and-flows.md) — tính năng nào chạy thật và flow demo.
3. [02-ai-agent-langgraph.md](02-ai-agent-langgraph.md) — LangGraph, System Prompt, Function Calling và prompt contract.
4. [03-backend-api.md](03-backend-api.md) — backend tối thiểu và API kết nối UI.
5. [04-data-and-golden-set.md](04-data-and-golden-set.md) — dữ liệu sự kiện giả và bộ đánh giá ≥20 case.
6. [05-build-plan.md](05-build-plan.md) — kế hoạch code theo thứ tự ưu tiên.
7. [06-test-and-demo.md](06-test-and-demo.md) — cách chạy eval và kịch bản trình bày CP3.
8. [07-mock-event-tool.md](07-mock-event-tool.md) — quy ước tool chạy thật trên nguồn dữ liệu mock.
9. [08-system-workflows.md](08-system-workflows.md) — workflow tổng thể, các nhánh Agent, lỗi và evaluation.

## Kiến trúc CP3 đề xuất

- Frontend: giữ Next.js/Vinext hiện tại.
- Backend: FastAPI.
- AI orchestration: LangGraph chia workflow; System Prompt và Function Calling xử lý quyết định AI có cấu trúc.
- Model: một model có structured output/tool calling.
- Dữ liệu: file JSON sự kiện giả tự sinh, chưa cần PostgreSQL.
- Eval: JSONL hoặc CSV với script chạy tự động.

CP3 không cần crawl dữ liệu thật, notification worker thật, đăng nhập, database production hoặc deploy. Các phần đó để sau khi vertical slice đã chạy ổn.

## Tuyên bố dữ liệu CP3

`search_events` là tool chạy thật nhưng đọc dữ liệu từ `events.json` do nhóm tự sinh. Vì chưa có nguồn sự kiện chính thức, mọi câu trả lời trong CP3 phải được ghi là dữ liệu minh họa. Agent không được nói hoặc ngụ ý rằng dữ liệu đã được lấy trực tiếp từ hệ thống VLearn.
