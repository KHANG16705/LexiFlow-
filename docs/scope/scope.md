# Scope: Flashcard by K

Ứng dụng giúp bạn gom từ vựng theo chủ đề và ôn lại theo từng bộ trên máy cá nhân.

**Build approach:** Tracer Bullet (mỗi lát cắt chạy xuyên suốt từ dữ liệu tới giao diện).
**Workflow:** Beta (kiểm tra luồng và dữ liệu sau khi xây dựng).

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Ứng dụng local và dữ liệu | Existing | existing |
| 2 | Quản lý từ, ảnh và nhập hàng loạt | Existing | existing |
| 3 | Ôn tập cách quãng | Existing | existing |
| 4 | Chủ đề và nhập danh sách trong màn hình thêm từ | Slice 1 | in-progress |

## Existing

### 1. Ứng dụng local và dữ liệu · existing
Giao diện React, API Express và MySQL lưu trên máy cá nhân. code in `backend/`, `frontend/`, `database/`, `scripts/`

### 2. Quản lý từ, ảnh và nhập hàng loạt · existing
Thêm, sửa, tìm kiếm, xóa từ; lưu ảnh riêng; xem trước và nhập danh sách. code in `backend/`, `frontend/`, `data/images/`

### 3. Ôn tập cách quãng · existing
Ôn theo lịch hoặc tự do, lưu tiến độ ôn vào MySQL. code in `backend/`, `frontend/`

## Slice 1

### 4. Chủ đề và nhập danh sách trong màn hình thêm từ · in-progress
Cho phép bạn tạo bộ từ theo chủ đề, mở một chủ đề để thêm từ riêng lẻ hoặc nhập hàng loạt bằng dấu chấm phẩy. Ảnh có thể được thêm khi tạo từ hoặc bổ sung sau.
**Done when:** các từ cũ được giữ trong chủ đề mặc định, chủ đề lọc đúng danh sách và lịch ôn, nhập có xem trước, nhận dấu chấm phẩy và hỗ trợ cập nhật ảnh về sau.
- [x] Design it (spec): `/architect chủ đề và nhập danh sách từ`
- [x] Build it: `/develop chủ đề và nhập danh sách từ`
  - [x] Migration và API chủ đề
  - [x] Trang danh sách và chi tiết chủ đề
  - [x] Nhập từng từ hoặc danh sách có dấu chấm phẩy
  - [x] Kiểm tra nâng cấp dữ liệu và luồng ôn
- [ ] Verify it: `/check verify chủ đề và nhập danh sách từ`
- [x] Test it: `/test chủ đề và nhập danh sách từ`
Spec [0001](../specs/0001-topics-and-bulk-import.md) · code in `backend/`, `frontend/`, `database/`

## Legend

`existing` là chức năng đã có trước khi lập phạm vi. `planned` là phần thay đổi đang chờ thiết kế. `in-progress` là tính năng đang được xây dựng.
