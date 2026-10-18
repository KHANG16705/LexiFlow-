# 0001. Chủ đề từ vựng và nhập theo dòng

**Date**: 2026-10-13
**Status**: In Progress

## Summary

Bạn có thể tạo chủ đề riêng cho mỗi ngôn ngữ rồi mở một chủ đề để xem từ và lịch ôn của chủ đề đó. Màn hình thêm từ cho phép nhập từng từ hoặc dán danh sách có cột ngăn bằng dấu chấm phẩy. Ảnh không bắt buộc lúc nhập, và luôn có thể thêm hoặc thay về sau.

## Context

Danh sách từ hiện chỉ chia theo ngôn ngữ. Khi bộ từ lớn lên, bạn cần nhóm từ theo nội dung để tìm và ôn tập gọn hơn. Nhập bằng Tab dễ bị sai cột khi soạn trong trình soạn thảo văn bản.

Ứng dụng đang có dữ liệu từ vựng và lịch ôn trong MySQL. Thay đổi phải giữ từ cũ, lịch ôn cũ, và các ảnh đang lưu. Chỉ có một người dùng local, không cần đồng bộ hay quyền truy cập nhiều người.

## Requirements

**User stories**:
- Là người học, tôi muốn tạo chủ đề trong một ngôn ngữ để sắp xếp từ theo nội dung.
- Là người học, tôi muốn thêm từng từ, nhập cả danh sách và thêm ảnh sau trong cùng luồng quản lý chủ đề.
- Là người học, tôi muốn ôn lịch hoặc ôn tự do một chủ đề cụ thể.

**Acceptance criteria**:
- **AC-1**: Mỗi chủ đề thuộc một ngôn ngữ, có tên không trùng trong cùng ngôn ngữ. Có thể tạo chủ đề và mở danh sách từ trong chủ đề đó.
- **AC-2**: Nếu cơ sở dữ liệu đã có từ, cập nhật tạo một chủ đề `Từ chưa phân loại` cho mỗi ngôn ngữ đang có từ và chuyển từ cùng lịch ôn sang chủ đề ấy. Không xóa dữ liệu hoặc ảnh.
- **AC-3**: Trong chủ đề, người dùng có thể thêm và sửa từ đơn lẻ. Ảnh là tùy chọn và có thể được thêm, gỡ hoặc thay sau khi nhập.
- **AC-4**: Màn hình thêm từ có cả chế độ nhập một từ và nhập danh sách. Bộ nhập đọc UTF-8, tách cột bằng dấu chấm phẩy, giữ cột trống và hỗ trợ dấu chấm phẩy nằm trong ô được đặt trong dấu nháy kép.
- **AC-5**: File nhập hoặc văn bản dán đều hiển thị bản xem trước, báo lỗi từng dòng, phát hiện từ trùng trong đúng chủ đề, và cho chọn bỏ qua hoặc cập nhật. Báo tổng số thêm, cập nhật, bỏ qua, lỗi sau khi lưu.
- **AC-6**: Nhiều ảnh nhập được ghép với các từ dựa trên tên file ở cột cuối. Ảnh thiếu được cảnh báo; từ vẫn được nhập. Chỉ nhận PNG, JPEG, WebP tối đa 5 MB.
- **AC-7**: Từ, tìm kiếm, số lượng và lựa chọn ôn theo lịch hoặc tự do được giới hạn vào chủ đề hiện tại. Ôn tự do không đổi lịch. Đánh giá ôn vẫn lưu và còn nguyên sau khi khởi động lại.
- **AC-8**: Có các mẫu nhập bằng dấu chấm phẩy cho Anh và Trung, kèm hướng dẫn thứ tự cột và cách đặt dấu nháy kép.

## Options considered

### Option 1: Chủ đề chứa nhiều từ, giữ lược đồ MySQL quan hệ hiện tại

Thêm bảng chủ đề, gắn từ với một chủ đề, và lọc các truy vấn hiện có theo chủ đề.

**Pros**:
- Phù hợp cách lưu từ và lịch ôn hiện tại.
- Có thể chuyển dữ liệu cũ mà không tạo bản sao từ.
- Ôn tập và nhập theo chủ đề dùng cùng danh sách từ.

**Cons**:
- Cần chạy chuyển đổi dữ liệu một lần.

### Option 2: Tạo một bộ từ riêng bằng cách nhân bản dữ liệu theo chủ đề

Lưu các bản sao của một từ trong mỗi bộ từ.

**Pros**:
- Các bộ có thể sửa độc lập.

**Cons**:
- Từ, ảnh và lịch ôn bị lặp lại, khó xử lý trùng và sao lưu.

## Decision

**Chosen option**: Option 1: Chủ đề chứa nhiều từ.

Mỗi từ thuộc đúng một chủ đề, chủ đề luôn thuộc một ngôn ngữ. Cho phép lặp một thuật ngữ ở hai chủ đề khác nhau; phát hiện trùng trong cùng chủ đề và ngôn ngữ. Từ cũ được gán vào chủ đề mặc định `Từ chưa phân loại`. Chủ đề có từ không có thao tác xóa trong lát cắt này để tránh mất dữ liệu nhầm.

Bảng nhập dùng dấu chấm phẩy như dấu phân cách. Nếu một ô chứa dấu chấm phẩy hoặc dấu nháy kép, bao cả ô trong dấu nháy kép và gõ dấu nháy kép thành hai dấu nháy liên tiếp. Ví dụ: `"say ""hello""; to greet"`.

**Implementation skills**: `develop` (`.agents/skills/develop/`) · `test` (`.agents/skills/test/`)

## Rationale

Một khóa ngoại nối từ với chủ đề giữ nguồn từ vựng duy nhất nên ảnh và lịch ôn đang có tiếp tục dùng được. Ràng buộc duy nhất theo chủ đề chặn lỗi nhập lặp nhưng cho phép cùng từ xuất hiện trong những nhóm khác nhau. Dữ liệu cũ được chuyển sang nhóm mặc định để không yêu cầu người dùng tự sắp xếp lại trước khi chạy ứng dụng.

Tách luồng nhập thành một trang riêng khiến người dùng phải đổi ngữ cảnh mỗi khi thêm một nhóm từ. Hai chế độ trong màn hình thêm từ giữ nguyên khả năng chỉnh sửa một từ, đồng thời làm danh sách dán thành luồng chính.

## Feature design

**Data model sketch**:

- `topics`: `id`, `language` (`en`/`zh`), `name`, `created_at`. Duy nhất `(language, name)`, thêm khóa `(id, language)` để xác nhận chủ đề cùng ngôn ngữ.
- `words`: giữ nguyên các trường hiện tại, thêm `topic_id` bắt buộc. Ràng buộc khóa ngoại `(topic_id, language)` tới `(topics.id, topics.language)`. Duy nhất `(topic_id, term)`. Xóa chủ đề có từ bị MySQL chặn.
- `review_log` tiếp tục tham chiếu từ. Đánh giá ôn và hạn ôn không đổi khi chuyển dữ liệu.
- Truy vấn chủ đề tổng hợp số từ và số từ tới hạn từ `words.due_at`.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Key errors |
|---|---|---|---|---|
| `/api/topics?language=en` | GET | Ngôn ngữ | Chủ đề, số từ, số từ đến hạn | Ngôn ngữ không hợp lệ |
| `/api/topics` | POST | `language`, `name` | `id` | Tên thiếu, trùng |
| `/api/words?language=en&topic_id=1` | GET | Ngôn ngữ, chủ đề | Từ trong chủ đề | Chủ đề không đúng ngôn ngữ |
| `/api/words` | POST | Nội dung từ, `language`, `topic_id`, ảnh tùy chọn | `id` | Thiếu từ hoặc nghĩa, trùng chủ đề |
| `/api/words/:id` | PUT | Nội dung sửa, `topic_id`, ảnh tùy chọn | `ok` | Từ hoặc chủ đề không tồn tại |
| `/api/import/preview` | POST | `language`, `topic_id`, văn bản dấu chấm phẩy | Dòng đã phân tích, lỗi, trùng | Sai chủ đề hoặc ngôn ngữ |
| `/api/import` | POST | Các trường xem trước, ảnh, chính sách trùng | Tổng thêm, cập nhật, bỏ qua, lỗi, cảnh báo | Dữ liệu đầu vào sai |
| `/api/words/:id/review` | POST | `rating` | Lần ôn tới | Từ không tồn tại |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Danh sách chủ đề | Tên và ngôn ngữ | `topics.name`, `topics.language` |
| Số từ mỗi chủ đề | Tổng số từ | `COUNT(words.id)` nhóm theo `topic_id` |
| Thẻ tới hạn | Tổng số từ tới hạn | `COUNT(words.id)` với `due_at <= UTC_TIMESTAMP(3)` |
| Dòng xem trước | Cột đã tách, vị trí dòng, lỗi | Văn bản UTF-8; bộ tách dấu chấm phẩy có dấu nháy kép |
| Từ trùng | Trùng trong chủ đề | `(topic_id, term)`, collation `utf8mb4_unicode_ci` |
| Lịch ôn tiếp theo | Hạn ôn | `words.interval_days`, lựa chọn đánh giá và quy tắc scheduler hiện có |

**Key invariants**:

- Chủ đề và từ của nó có cùng ngôn ngữ.
- Một từ thuộc đúng một chủ đề; cùng thuật ngữ có thể tồn tại ở chủ đề khác.
- Lỗi khi nhập một dòng được báo theo số dòng và không làm hủy các dòng hợp lệ.
- Tệp ảnh chỉ được lưu nếu được nhận dạng là PNG, JPEG hoặc WebP và không vượt 5 MB.
- Chủ đề không bị xóa khi còn từ.

**Security model**: Ứng dụng một người dùng và chỉ nghe tại loopback như hiện tại. Backend xác nhận chủ đề, ngôn ngữ và nội dung trước mọi thao tác ghi.

**Configuration required**: Không đổi cấu hình môi trường.

**Critical test scenarios**:
- Tạo hai chủ đề riêng ngôn ngữ và xem bộ đếm, verifies **AC-1**, **AC-7**.
- Cập nhật database có dữ liệu cũ và xác nhận từ, ảnh, lịch ôn giữ nguyên, verifies **AC-2**.
- Thêm ảnh sau cho từ nhập không ảnh, verifies **AC-3**, **AC-6**.
- Dán dữ liệu UTF-8 có cột trống và dấu chấm phẩy trong dấu nháy; xác nhận preview, verifies **AC-4**, **AC-5**.
- Nhập ảnh khớp và ảnh thiếu, xác nhận tổng kết, verifies **AC-5**, **AC-6**.
- Ôn theo lịch và tự do trong chủ đề, khởi động lại và kiểm tra lịch, verifies **AC-7**.

## Build plan

1. [x] Tạo bảng chủ đề, di chuyển từ cũ sang chủ đề mặc định an toàn, rồi buộc từ gắn chủ đề. Kiểm tra trên MySQL đang dùng, satisfies **AC-1**, **AC-2**, **AC-7**.
2. [x] Thêm API chủ đề và giới hạn từ, tìm kiếm, bộ đếm theo chủ đề. satisfies **AC-1**, **AC-3**, **AC-7**.
3. [x] Tạo màn hình chủ đề và luồng thêm một từ, có thể bổ sung ảnh. satisfies **AC-1**, **AC-3**, **AC-7**.
4. [x] Chuyển bộ nhập vào màn hình thêm từ, đổi bộ phân cách sang dấu chấm phẩy, giữ xem trước, nối ảnh, cập nhật mẫu và hướng dẫn. satisfies **AC-4**, **AC-5**, **AC-6**, **AC-8**.
5. [x] Kiểm tra build, cơ sở dữ liệu, nhập, ôn theo chủ đề và dữ liệu sau lần khởi động lại. satisfies **AC-1** through **AC-8**.

## Consequences

**Positive**:
- Từ vựng và lịch ôn có thể được nhìn và ôn theo chủ đề.
- Thêm từng từ và nhập cả danh sách ở cùng một nơi.
- Có thể hoàn tất nhập văn bản trước rồi thêm ảnh riêng.

**Tradeoffs**:
- Dấu chấm phẩy là ký tự phân cột, nên nội dung có dấu này cần được đặt trong dấu nháy kép.
- Từ cũ xuất hiện trong chủ đề `Từ chưa phân loại` cho tới khi người dùng nhập sang chủ đề mới.

## Follow-up

- Không có.
