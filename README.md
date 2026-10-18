# LexiFlow

LexiFlow là website học từ vựng tiếng Anh bằng flashcard và lịch ôn cá nhân. Frontend dùng React 19, Vite và React Router. Backend dùng Node.js, Express và MySQL 8. Dữ liệu tài khoản, bộ từ, tiến độ và lịch sử ôn được lưu trong MySQL.

## Chạy trên máy hiện tại

Ứng dụng dùng MySQL Windows service `MySQL80` theo cấu hình trong file `.env` hiện có. Từ thư mục dự án, chạy:

```bash
npm start
```

Ứng dụng chạy tại `http://127.0.0.1:3001`. Dùng `Ctrl+C` trong cửa sổ terminal để dừng.

## Cài đặt mới

Yêu cầu Node.js 20 trở lên, npm và MySQL 8. Cài đặt hiện có dùng Docker Compose. Cài Docker Desktop trước rồi chạy từ thư mục gốc:

```bash
npm run setup
npm start
```

`npm run setup` cài backend và frontend, tạo `.env` nếu chưa có, rồi build giao diện. Mật khẩu được sinh ngẫu nhiên và chỉ lưu trong `.env`, file này không đưa vào Git.

### MySQL

Ứng dụng mặc định dùng database `flashcardbyk`. File `.env.example` minh họa các biến cần thiết:

```text
DB_MODE=docker
DB_HOST=127.0.0.1
DB_PORT=3308
DB_NAME=flashcardbyk
DB_USER=flashcard
DB_PASSWORD=<mật khẩu ngẫu nhiên>
MYSQL_ROOT_PASSWORD=<mật khẩu root ngẫu nhiên>
PORT=3001
COOKIE_SECURE=false
```

`npm start` khởi động MySQL Compose nếu `DB_MODE=docker`, sau đó chờ MySQL sẵn sàng rồi mở API. Nếu dùng MySQL đã cài sẵn, đặt `DB_MODE=service`, chọn `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` phù hợp. Không lưu mật khẩu quản trị MySQL trong `.env`.

Schema ban đầu nằm trong `database/01-schema.sql`; dữ liệu mẫu hiện tại ở `database/nobka-seed.sql`. Khi backend khởi động, migration bổ sung LexiFlow được áp dụng tự động. Có thể xem phần thay đổi SQL ở `database/migrations/0002-lexiflow.sql`. Migration chỉ thêm bảng mới, chuyển các chủ đề hiện có thành bộ từ và nối chúng với từ sẵn có. Từ vựng, ảnh, lịch cũ và Docker volume không bị xóa.

## Tài khoản và cách học

1. Mở `/register` để tạo tài khoản. Mật khẩu cần tối thiểu 10 ký tự.
2. Vào **Kho từ vựng**, tìm bộ theo từ khóa, trình độ, mục tiêu hoặc chủ đề.
3. Mở một bộ từ, chọn **Bắt đầu học** hoặc **Ôn tự do**.
4. Trong phiên học, hãy nhớ nghĩa trước khi lật thẻ. Chọn Quên, Khó, Tốt hoặc Dễ để ghi nhận kết quả.
5. Xem các thẻ đến hạn trong **Ôn tập**, hoặc xem số liệu và lịch sử tại **Tiến độ**.
6. Tạo bộ cá nhân, sau đó lưu từ từ thư viện vào bộ đó.

Đăng nhập dùng cookie phiên `HttpOnly`, `SameSite=Lax`. Mật khẩu được băm bằng `scrypt`. Tiến độ và lịch sử thuộc về đúng người dùng. Một thẻ chỉ được ghi nhận một lần trong cùng một phiên. Ôn tự do không thay đổi lịch ôn.

## Lệnh phát triển và kiểm tra

```bash
npm --prefix backend install
npm --prefix frontend install
npm --prefix frontend run dev
npm --prefix frontend run build
npm test
```

Để chạy smoke test API cần backend và MySQL đang hoạt động:

```bash
node scripts/lexiflow-smoke.mjs
```

Smoke test tạo một tài khoản kiểm tra tạm thời, xác minh thư viện, phân quyền, phiên học, ghi rating, chặn rating lặp, dashboard và đăng xuất, rồi xóa tài khoản kiểm tra cùng dữ liệu liên quan.

Frontend dev server ở `http://127.0.0.1:5173`, gọi API qua Vite proxy tới cổng 3001. API dùng tiền tố `/api/v1`; health check cũ ở `/api/health`.

## API chính

- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`
- `GET /api/v1/decks`, `GET /api/v1/decks/:id`, `GET /api/v1/decks/:id/vocabularies`
- `POST /api/v1/study-sessions`, `POST /api/v1/study-sessions/:id/reveal`, `POST /api/v1/study-sessions/:id/reviews`, `POST /api/v1/study-sessions/:id/complete`
- `GET /api/v1/reviews/due`, `GET /api/v1/dashboard`, `GET /api/v1/progress/summary`, `GET /api/v1/progress/history`
- `GET /api/v1/my-decks`, `POST /api/v1/my-decks`, `PATCH /api/v1/my-decks/:id`, `DELETE /api/v1/my-decks/:id`
- `POST /api/v1/my-decks/:id/vocabularies`, `DELETE /api/v1/my-decks/:id/vocabularies/:vocabularyId`

## Sao lưu và giới hạn hiện tại

Giữ riêng bản sao database và `data/images/`. Với Docker, không xóa volume `flashcardbyk_mysql_data` để giữ dữ liệu.

Các chủ đề có sẵn được chuyển thành bộ từ công khai. Những bộ đó kế thừa dữ liệu thật trong database; trình độ CEFR chỉ được gán khi tên chủ đề hiện tại nêu rõ cấp độ. Mục tiêu mặc định là giao tiếp tổng quát. Lịch ôn ẩn danh cũ vẫn được giữ trong `review_log` và `words`; tài khoản mới bắt đầu tiến độ cá nhân riêng, không nhận các lần ôn cũ vốn không gắn với người dùng nào. Bộ từ cá nhân hiện lưu các từ chọn từ thư viện; chưa có màn hình tự tạo thẻ từ vựng mới.

Nếu cổng 3001 đang bận, đổi `PORT` trong `.env`. Nếu dùng Docker mà MySQL không khởi động, kiểm tra Docker Desktop và cổng `DB_PORT`. Nếu đổi mật khẩu của một volume MySQL đã tạo, giá trị mới trong `.env` không tự đổi mật khẩu bên trong volume đó.
