# Eval changelog

## Golden set sau run-002

`run-002` dùng snapshot `results/run-002-golden-set.jsonl`. CSV gốc ghi nhận 13/24; summary được sửa theo chính CSV sau khi review phát hiện bản recovery cũ ghi sai 14/24.

Các chỉnh sửa trước `run-003`:

- GS-006, GS-012, GS-015, GS-016: chỉ chấm topic được nói rõ hoặc suy ra trực tiếp từ câu hỏi; không bắt model tái tạo toàn bộ tag nội bộ của dataset.
- GS-019: thay “cuối tháng” bằng range 24–31/8 để loại cách hiểu mơ hồ.
- GS-020: “từ hôm nay” bắt đầu tại `current_date`, không phải đầu ngày.
- GS-023, GS-024: forbidden claim chỉ cấm khẳng định có kết quả; không bắt nhầm câu phủ định “không tìm thấy”.
- Prompt: chuẩn hóa `online` thành `format=online`; thời gian mơ hồ phải hỏi lại.

## Golden set sau run-003

`run-003` dùng snapshot `results/run-003-golden-set.jsonl`. Kết quả 19/24 được giữ nguyên.

Các chỉnh sửa trước `run-004`:

- GS-016: câu hỏi đích danh event không bắt model suy ra topic tag nội bộ.
- GS-020: thống nhất “hôm nay” là toàn bộ ngày theo timezone `+07:00`.
- Agent canonicalize `online`/`trực tuyến` thành `format=online`.
- Agent canonicalize date-only thành đầu ngày/cuối ngày; “hôm nay” bắt đầu lúc 00:00.

## Kết quả run-004

- Overall: 21/24 (87.5%).
- Intent: 23/24 (95.8%).
- Filter: 22/24 (91.7%).
- Tool và behavior: 24/24 (100%).
- Retrieval: 23/24 (95.8%).
- Groundedness theo evaluator tại thời điểm chạy: 24/24; sau review, response composer được đổi sang deterministic để claim text có thể kiểm chứng trực tiếp từ event source.
- Golden set, event dataset và 24 trace đã được snapshot trong `results/`.

## Kết quả run-005

- Overall và filter: 22/24 (91.7%).
- Intent, tool, retrieval, groundedness và behavior: 24/24 (100%).
- Hai case fail GS-004 và GS-006 được giữ nguyên trong báo cáo; đều là filter mismatch, không gây retrieval sai hoặc hallucination.
- Run tự lưu hash, snapshot golden set, snapshot event dataset và 24 trace bất biến.
