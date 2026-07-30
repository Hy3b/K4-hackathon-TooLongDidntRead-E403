# Technical verification — CP5 preparation

Thời điểm: 31/07/2026
Phạm vi: kiểm tra tự động và API dry run. **Không thay thế validation người thật hoặc full demo có bấm giờ.**

## Test tự động

| Thành phần | Lệnh | Kết quả |
|---|---|---|
| Backend | `backend/.venv/Scripts/python.exe -m pytest -q` | `10 passed` |
| Frontend | `npm test` trong `codebase/` | Build thành công, `2 passed` |
| TypeScript | `npm run typecheck` trong `codebase/` | Thành công, không có lỗi type |

Frontend build có cảnh báo route classification của Vinext và cảnh báo thử nghiệm/deprecation từ dependency; không làm test fail.

## API dry run

Backend được chạy tạm trên cổng `8011`, gọi bốn nhánh rồi dừng server.

| Case | Intent | Tool | Events | Warning/clarification | Trace |
|---|---|---:|---:|---|---|
| Happy path | `search_events` | Có | 1 | Không | `run_a63f089bbeaf41bfa7fe2a4f312948bd` |
| Thiếu thời gian | `search_events` | Không | 0 | Clarification | `run_59b4323d24724d2a85d5d828cebede32` |
| Dữ liệu mâu thuẫn | `search_events` | Có | 1 | 1 warning | `run_2b9784ab1d1b4fdf812fa0c6a63a32ea` |
| Ngoài phạm vi | `register_event` | Không | 0 | Từ chối hành động | `run_ad0dd73aa68c41c8855dbda00f30def7` |

## Kết luận

- Bốn nhánh backend quan trọng hoạt động đúng theo thiết kế.
- Frontend build/test/typecheck đều xanh.
- Chưa xác minh full flow trên trình duyệt với backend thật trong một phiên có bấm giờ.
- Chưa có validation từ người dùng thật.
