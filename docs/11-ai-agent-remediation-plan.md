# AI Agent Remediation Plan

## Implementation checkpoint (2026-07-31)

Đã triển khai Wave 0 và phần P0 của Wave 1–2: direct-answer/error routing,
timeout model, history bounded theo completed turns, validation history API,
timezone-safe retrieval, conflict warning, deterministic stream contract và
loại bỏ fake sleep hậu kỳ. Backend hiện có 15 test pass; frontend typecheck,
build và 3 contract tests pass.

Phần còn lại trước production canary: async cancellation thật cho model
thread, bounded concurrency/backpressure, trace writer bất đồng bộ, event
metadata rehydrate cho follow-up và stream status theo execution node.

Ngày lập: 31/07/2026

Phạm vi: sửa luồng AI Event Assistant hiện tại để khôi phục tính đúng, hội thoại có ngữ cảnh và độ trễ có giới hạn. Không chuyển sang multi-agent hoặc agent loop. Giữ pipeline LangGraph hữu hạn, tối đa một model call và một lần tìm kiếm mỗi lượt; dữ kiện sự kiện tiếp tục được compose deterministic từ repository result.

## 1. Baseline và chẩn đoán

### Baseline đo được

| Tập dữ liệu | Kết quả |
|---|---|
| Eval run-005 | 22/24 overall (91,7%), latency p50 1.734 ms, p90 3.727 ms, max 6.454 ms |
| Eval run-006 | 0/24 overall, latency p50 19.812 ms, p90 47.050 ms |
| 229 live traces | p50 3.549 ms, p90 khoảng 52 giây, max 469 giây |
| Backend tests | 10 pass, 1 fail ở so sánh datetime khác timezone offset |
| Frontend tests | build thành công nhưng 3 test fail do UI/API contract đã drift |

### Nguyên nhân gốc

1. `direct_answer` do model tạo không được ghi vào state; greeting/capabilities cũng không tạo answer nên rơi vào fallback “chưa hiểu”.
2. Frontend gọi `.slice(0, -2)` trên snapshot history vốn chưa có hai message mới, làm mất đúng lượt hoàn tất gần nhất.
3. History chỉ gửi text tổng quát, không gửi event ID/title/time; follow-up như “cái thứ hai” không có dữ liệu để resolve.
4. Model/tool exception bị nuốt và route thành direct answer/no-result; trace vẫn ghi `success`.
5. Client timeout không hủy work trên server. Có request chạy tiếp 240–469 giây sau khi client đã dừng.
6. Model SDK không có deadline/retry budget rõ ràng; runtime không có backpressure.
7. `/chat/stream` chờ agent chạy xong rồi mới chia text theo từ và sleep 18 ms/từ; đây là animation hậu kỳ, không phải streaming execution.
8. Trace persistence `fsync` và quét retention được await trên critical path.
9. Conflict được thu thập nhưng không còn user-visible warning.
10. Repository so sánh ISO datetime bằng chuỗi, thiếu tìm theo tên và ranking deterministic.
11. Prompt mới tự suy “từ hôm nay” trái với spec/golden set đang yêu cầu clarification.
12. Schema history/filter/intent còn lỏng và không có budget.

## 2. Mục tiêu phát hành

- `direct_answer`, greeting, capabilities và out-of-scope trả đúng contract.
- Model/tool timeout hoặc lỗi không bao giờ bị báo thành `success` hay “không tìm thấy”.
- Follow-up giữ đúng lượt gần nhất và resolve được event đã trả ở lượt trước.
- Groundedness 24/24: mọi event fact trong answer/card là tập con của repository result.
- Ba eval live liên tiếp đạt ít nhất 22/24 overall.
- Latency sau ổn định: p50 không quá 3,5 giây, p90 không quá 12 giây, hard deadline không quá 15 giây.
- Client disconnect/deadline dọn model task trong 500 ms; không có request chạy ngầm hàng phút.
- Backend tests, frontend tests và typecheck đều pass 100%.

## 3. Kế hoạch thực thi

### Wave 0 — Khóa contract bằng regression tests

#### T0.1 Agent/API contract tests

- Files: `backend/tests/test_agent_contract.py`, `backend/tests/test_chat_api.py`.
- Viết test đỏ trước cho greeting, capabilities, model-provided `direct_answer`, out-of-scope, invalid structured output, model timeout, tool exception, true no-result và conflict.
- Acceptance:
  - Phân biệt được `success`, `no_result`, `error`, `timeout`, `busy`, `cancelled`.
  - Tool/model failure không chứa copy “không tìm thấy sự kiện”.
  - Conflict xuất hiện trong JSON và warning.

#### T0.2 Retrieval contract tests

- Files: `backend/tests/test_repository.py`, `backend/tests/test_retrieval_ranking.py`.
- Giữ test timezone-offset đang fail; thêm exact/substring title, cancelled named-event, rank và tie-break.
- Acceptance:
  - So sánh theo absolute instant, không theo chuỗi.
  - Exact title luôn đứng trước topic-only.
  - Kết quả đồng hạng giữ cùng thứ tự trong 20 lần chạy.

#### T0.3 Frontend history/stream tests

- Files: `codebase/tests/chat-history.test.mjs`, `codebase/tests/stream-lifecycle.test.mjs`, cập nhật `codebase/tests/rendered-html.test.mjs`, `codebase/package.json`.
- Tái tạo lỗi mất lượt gần nhất, mất event metadata, history vượt budget, NDJSON cụt và request abort.
- Đổi `npm test` để chạy toàn bộ `tests/*.test.mjs`, không chỉ một file test cũ.
- Acceptance:
  - Lượt hoàn tất gần nhất xuất hiện đúng một lần trong request sau.
  - Không cắt rời user/assistant pair.
  - Test không còn tham chiếu các Next API route đã xóa.
  - `npm test` thực sự chạy cả test history và stream lifecycle mới.

#### T0.4 Feature flags và telemetry contract

- Files: `backend/app/config.py`, `backend/app/main.py`, `codebase/app/use-chat-history.ts`, tài liệu `.env.example` tương ứng.
- Khai báo và kiểm thử các flag `CHAT_HISTORY_V2`, `AGENT_ASYNC_RUNTIME`, `TRACE_ASYNC_ENABLED`, `CHAT_STREAM_V2`; mặc định `false` cho rollout chuyển tiếp.
- Mỗi flag có counter theo outcome/latency và compatibility test giữa frontend/backend cũ-mới.
- Acceptance:
  - Tắt từng flag khôi phục đúng đường fallback đã mô tả, không mất dữ liệu hội thoại.
  - Không có flag “chỉ tồn tại trong kế hoạch rollout” mà thiếu implementation/config/test.

### Wave 1 — P0 correctness

#### T1.0 Model-call deadline tối thiểu

- Files: `backend/app/config.py`, `backend/app/agent/nodes/understand_query.py`.
- Trước khi thêm retry, cấu hình SDK request timeout ngắn hơn client và `max_retries=0`; bao toàn bộ structured-call attempt trong một total deadline.
- Structured-output retry ở T1.1 chỉ được bật khi remaining budget đủ; SDK retry và application retry dùng chung tổng attempt budget.
- Acceptance:
  - Fake hung model kết thúc trong deadline.
  - Tổng số attempts, gồm SDK và application, không vượt hai; timeout/cancel không retry.

#### T1.1 Propagate direct answer và siết state/schema

- Files: `backend/app/agent/schemas.py`, `backend/app/agent/state.py`, `backend/app/agent/nodes/understand_query.py`, `backend/app/agent/graph.py`.
- Ghi `result.direct_answer` vào state; shortcut greeting/capabilities dùng template deterministic.
- Dùng `Literal`/enum, `extra="forbid"` và validator cho intent, confidence, filters, timezone/range.
- Structured output sai được retry đúng một lần trong total deadline đã có từ T1.0; sau đó trả `AGENT_OUTPUT_INVALID`.
- Acceptance:
  - Direct-answer cases không còn fallback “chưa hiểu”.
  - Bình thường tối đa một model call; chỉ invalid schema mới được call lần hai.

#### T1.2 Tách error khỏi no-result

- Files: `backend/app/agent/graph.py`, `backend/app/api/chat.py`, `backend/app/agent/nodes/compose_response.py`.
- Thêm typed outcome/error code: `MODEL_TIMEOUT`, `MODEL_UNAVAILABLE`, `AGENT_OUTPUT_INVALID`, `TOOL_UNAVAILABLE`, `AGENT_BUSY`, `CANCELLED`.
- Chỉ tool search thành công với danh sách rỗng mới là `no_result`.
- Trace `result_status` lấy từ outcome thật, không hardcode `success`.
- Giữ `trace_id` trong mọi error envelope.
- Acceptance:
  - 0/100 injected model/tool failures bị ghi `success` hoặc `no_result`.
  - Frontend có thể phân biệt retryable error với empty search.

#### T1.3 Phục hồi conflict handling

- Files: `backend/app/agent/nodes/validate_results.py`, `backend/app/agent/nodes/compose_response.py`, `backend/app/api/chat.py`.
- Đưa conflict field/values vào response; hạ confidence và không trình bày một giá trị conflict như fact chắc chắn.
- Acceptance:
  - Mọi event `needs_confirmation` có warning cụ thể.
  - Grounded answer không chọn âm thầm một giá trị đang mâu thuẫn.

#### T1.4 Đồng bộ prompt với product contract

- Files: `backend/app/agent/prompts.py`, `spec.md`, `backend/eval/golden-set.jsonl`.
- Khóa policy hiện tại: truy vấn thời gian mơ hồ như “có sự kiện nào không/gần đây” phải hỏi clarification. Không sửa spec/golden set để hợp thức hóa regression của implementation.
- Acceptance:
  - Không còn prompt/spec/golden set mâu thuẫn.

### Wave 2 — Conversation fidelity và retrieval

#### T2.1 History serializer có budget và event metadata

- Dependency: triển khai T2.2 title retrieval trước; T2.1 chỉ được đóng khi regression follow-up named-event qua repository pass.
- Files: `codebase/app/use-chat-history.ts`, `backend/app/api/chat.py`, `backend/app/agent/schemas.py`, `backend/app/agent/state.py`, `backend/app/agent/prompts.py`, `backend/app/agent/nodes/understand_query.py`, `backend/app/events/repository.py`.
- Bỏ `.slice(0, -2)`; serialize snapshot các completed turns trước current message.
- Gửi event metadata rút gọn cần cho follow-up: `id`, `title`, `starts_at`, `location`, `format`, `status`.
- Server dùng typed `HistoryMessage`; tối đa 8 completed turns và 8.000 ký tự, cắt từ cũ nhất theo cặp.
- Structured output có `referenced_event_id`/`title_query`; prompt hướng dẫn resolve đại từ/thứ tự từ event metadata. Repository rehydrate event theo ID/title trước khi compose, không tin fact do client gửi.
- Không gửi placeholder assistant rỗng.
- Acceptance:
  - “Sự kiện thứ hai/cái đó/còn tuần sau?” resolve đúng trong regression tests.
  - Event metadata từ client chỉ là reference; mọi fact cuối được rehydrate từ repository.
  - Payload không vượt budget và lượt gần nhất chỉ có đúng một bản.

#### T2.2 Datetime correctness và deterministic ranking

- Files: `backend/app/events/repository.py`, `backend/app/events/service.py`, `backend/app/agent/schemas.py`.
- Parse filter/event thành aware UTC instant trước khi so sánh.
- Thêm `title_query`; `include_cancelled` chỉ có hiệu lực khi có truy vấn tên cụ thể.
- Ranking: exact title > title substring > số filter/topic match > thời gian gần nhất > ID.
- Limit top 3 chỉ sau filtering, dedupe và ranking.
- Acceptance:
  - Backend suite pass, gồm timezone boundary.
  - Precision@3 cho named-event cases là 100%.

### Wave 3 — Latency control và observability

#### T3.1 Async runtime, deadline và backpressure

- Files: `backend/app/config.py`, `backend/app/agent/runtime.py` (mới), `backend/app/agent/nodes/understand_query.py`, `backend/app/api/chat.py`.
- Dùng async model invocation.
- Kế thừa total deadline/attempt budget của T1.0 và chuyển sang async cancellation; điểm bắt đầu đề xuất 10 giây model, 12 giây total, sau đó hiệu chỉnh bằng canary.
- Retry budget 0–1; không retry timeout/cancel.
- Bounded semaphore và queue hữu hạn; request vượt capacity trả `AGENT_BUSY`.
- Propagate disconnect/cancellation tới model task.
- Acceptance:
  - Fake hung model: mọi request kết thúc trong 12,5 giây.
  - Active model tasks về 0 trong 500 ms sau cancel.
  - Inflight không vượt cấu hình và overload trả sớm.

#### T3.2 Trace và metrics ra khỏi critical path

- Files: `backend/app/observability/trace_store.py`, `backend/app/observability/trace_writer.py` (mới), `backend/app/main.py`, `backend/app/config.py`.
- Request chỉ enqueue trace vào bounded queue.
- Writer nền ghi atomic; retention chạy startup/theo batch, không glob/stat/sort mỗi request.
- FastAPI lifespan start writer một lần, drain tối đa hai giây khi shutdown và đóng sạch worker; cấu hình rõ queue capacity/drop policy.
- Đo riêng queue time, model attempt/TTFT/total/retry/tokens, tool/DB, trace enqueue/write và stream TTLB.
- Acceptance:
  - Trace enqueue p99 không quá 2 ms.
  - Storage chậm một giây không làm chat tăng quá 10 ms.
  - Dashboard/report tách được provider latency khỏi app overhead.
  - Shutdown test xác minh drain/timeout/drop counter và không để background task sống.

#### T3.3 Tái sử dụng model client

- Files: `backend/app/agent/nodes/understand_query.py` hoặc factory riêng.
- Khởi tạo một `ChatOpenAI`/prompt/bound schema dùng lại thay vì dựng mỗi request.
- Acceptance:
  - Không thay đổi output contract; cold/warm timing được ghi riêng.

### Wave 4 — Streaming và frontend runtime

Đây là scope mở rộng sau release cut-line. Chỉ triển khai Wave 4 khi correctness/history/deadline gates của Wave 0–3 đã xanh; hackathon demo có thể dùng non-stream `/api/chat` nếu không còn thời gian.

#### T4.1 Streaming theo execution thật

- Files: `backend/app/api/chat.py`.
- Tách core async runner khỏi route.
- `/chat/stream` phát status khi node thực bắt đầu/kết thúc; không gọi lại `chat_endpoint()`.
- Bỏ `asyncio.sleep(0.018)` và word-by-word animation.
- Phát typed `error`/`done`; disconnect đóng graph/model task.
- Acceptance:
  - First status p95 không quá 100 ms.
  - Streaming overhead sau agent completion không quá 50 ms.
  - Không có task sống sau disconnect 500 ms.
- Fallback: nếu stream v2 lỗi, frontend chuyển tạm sang non-stream `/api/chat`; không phục hồi fake stream.

#### T4.2 Abortable frontend và giảm render/storage churn

- Files: `codebase/app/use-chat-history.ts`, `codebase/app/page.tsx`.
- Dùng `AbortController`; hủy request khi timeout/retry/đổi conversation/unmount.
- Parse error envelope; giữ partial answer nếu stream cụt.
- Debounce cập nhật delta/localStorage; persist remote/local khi `done`, không serialize toàn bộ history mỗi delta.
- Chỉ auto-scroll khi user đang gần đáy.
- Acceptance:
  - Không có stale response ghi vào conversation mới.
  - Không duplicate user message khi retry.
  - Không unhandled rejection hoặc smooth-scroll jank trong test.

### Wave 5 — Eval, rollout và docs

#### T5.1 Eval preflight và quality gates

- Files: `backend/eval/run_eval.py`, `backend/tests/test_eval.py`, `backend/eval/CHANGELOG.md`.
- Preflight readiness, model/prompt/schema version và dataset hash.
- Nếu environment/provider không sẵn sàng, đánh dấu `INVALID_ENV`; không ghi một run 0% như quality regression.
- Ghi error/timeout/cancel counts và latency p50/p90/max.
- Chạy ba eval live bằng run ID mới.
- Acceptance:
  - Ba run liên tiếp đạt ít nhất 22/24 overall.
  - Groundedness 24/24, false no-result bằng 0.
  - p50 không quá 3,5 giây, p90 không quá 12 giây, max không quá 15 giây.

#### T5.2 Đồng bộ docs với code

- Files: `docs/02-ai-agent-langgraph.md`, `docs/03-backend-api.md`, `docs/06-test-and-demo.md`, `docs/10-technical-verification.md`, `backend/README.md`, `codebase/README.md`.
- Mô tả graph thật, deterministic compose, error taxonomy, history budget, deadlines/backpressure, stream protocol và trace trade-off.
- Xóa mô tả `prepare_tool_call`/compose LLM/JSON repository nếu implementation không còn như vậy.
- Acceptance:
  - Docs không nhắc node không tồn tại.
  - README không quảng bá run cũ như “mới nhất”.
  - Full backend/frontend suite pass.

## 4. Quality gates bắt buộc

1. Tests/typecheck pass 100%.
2. Direct answer, history follow-up, conflict, datetime offset, title rank đều có regression test.
3. Không model/tool failure nào bị báo `success` hoặc `no_result`.
4. Event facts luôn grounded từ repository result.
5. Tối đa một normal model call và một tool call/lượt.
6. Deadline/disconnect dọn task trong 500 ms.
7. Ba eval live liên tiếp đạt quality và latency threshold.
8. Eval preflight fail được phân loại `INVALID_ENV`.
9. API/schema/docs khớp release.

## 5. Rollout và rollback

1. Implement và test các feature flags/telemetry ở T0.4 trước rollout.
2. Deploy frontend hiểu error envelope/history metadata/abort nhưng giữ feature flag tắt.
3. Deploy backend correctness và retrieval; chạy fault matrix và eval nội bộ.
4. Bật history v2 theo 10% → 50% → 100%; theo dõi follow-up accuracy và 422 rate.
5. Bật async runtime/backpressure theo canary. Rollback release nếu cancellation leak hoặc error rate tăng hơn 2 điểm phần trăm.
6. Bật async trace; nếu queue drop trên 1%, tắt file trace và giữ structured logs, không đưa `fsync` về critical path.
7. Bật stream v2 cuối cùng; nếu stream error trên 1% hoặc first status p95 trên 500 ms, chuyển client sang `/api/chat`.
8. Chỉ promote release sau ba eval liên tiếp đạt gate.

Metadata history mới là optional và các thay đổi trên không yêu cầu migration dữ liệu, nên có thể rollback bằng release image/feature flag.
