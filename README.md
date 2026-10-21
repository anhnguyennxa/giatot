# Giá Tốt — Sàn thương mại điện tử

> **Mua đúng giá · Sắm thật vui.** Đồ án xây dựng sàn TMĐT nhiều người bán (kiểu Shopee) gồm 3 phân hệ: **Người mua**, **Kênh người bán** và **Quản trị**, dựa trên bộ thiết kế trong [`docs/thiet-ke`](docs/thiet-ke).

![Nhận diện thương hiệu](docs/thiet-ke/logo-gia-tot.png)

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Ngôn ngữ | TypeScript |
| Backend | NestJS 11 (REST API, JWT, class-validator) |
| Frontend | Next.js 15 (App Router) + Tailwind CSS |
| Cơ sở dữ liệu | PostgreSQL (Prisma ORM), Redis (cache) |
| Tích hợp | VNPay Sandbox (thanh toán), GHN API (vận chuyển) |
| Triển khai | Docker / Docker Compose, Vercel (frontend), Render (backend + DB + Redis) |

## Chức năng

**Người mua** (`/`)
- Trang chủ: banner, danh mục, Flash Sale có đếm ngược, Giá Tốt Mall, gợi ý hôm nay
- Tìm kiếm có lịch sử & gợi ý, lọc theo giá / đánh giá / miễn phí vận chuyển, sắp xếp, phân trang
- Trang danh mục: danh mục con, thương hiệu nổi bật, lọc giá; trang cửa hàng; chi tiết sản phẩm (phân loại, số lượng, yêu thích, đánh giá, sản phẩm tương tự)
- Giỏ hàng nhóm theo shop → Thanh toán: địa chỉ theo danh mục tỉnh/quận/phường của **GHN**, **phí ship tính qua GHN**, voucher sàn/shop, **COD hoặc VNPay**
- Đơn mua theo trạng thái, theo dõi vận đơn GHN, thanh toán lại, hủy đơn, xác nhận đã nhận, đánh giá (+200 xu), trả hàng/hoàn tiền, mua lại
- Voucher & Xu (điểm danh 7 ngày), yêu thích, thông báo, hồ sơ & sổ địa chỉ

**Kênh người bán** (`/seller`)
- Đăng ký bán hàng (chờ admin duyệt), tổng quan doanh thu 7 ngày & việc cần xử lý
- Quản lý sản phẩm (thêm/sửa/ẩn/xóa, phân loại, ảnh), sản phẩm mới phải qua kiểm duyệt
- Xử lý đơn: xác nhận → **tạo vận đơn GHN** → giao cho GHN → đã giao; in phiếu giao hàng; hủy đơn; chấp nhận trả hàng
- Voucher của shop, tài chính & đối soát (phí sàn 7%, rút tiền), phân tích, cài đặt shop

**Quản trị** (`/admin`)
- Tổng quan nền tảng (GMV 7 ngày), duyệt người bán & gắn nhãn Mall, khóa/mở khóa người dùng
- Danh mục / danh mục con / thương hiệu, duyệt hoặc gỡ sản phẩm, voucher sàn
- Phân xử khiếu nại & hoàn tiền, quản lý banner trang chủ, báo cáo doanh thu (xuất CSV)

## Cấu trúc thư mục

```
GiaTot/
├── backend/            # NestJS API (cổng 4000, tiền tố /api)
│   ├── prisma/         # schema.prisma, migrations, seed.ts
│   └── src/
│       ├── auth/       # đăng ký, đăng nhập, JWT
│       ├── catalog/    # trang chủ, danh mục, tìm kiếm sản phẩm (cache Redis)
│       ├── account/    # giỏ hàng, địa chỉ, yêu thích, voucher, xu, thông báo
│       ├── orders/     # báo giá, đặt hàng, VNPay, đánh giá, trả hàng
│       ├── shipping/   # tích hợp GHN (có chế độ giả lập)
│       ├── seller/     # API kênh người bán
│       ├── admin/      # API quản trị
│       └── redis/      # CacheService (Redis, tự fallback bộ nhớ)
├── frontend/           # Next.js (cổng 3000)
│   └── src/app/
│       ├── (store)/    # các trang người mua
│       ├── seller/     # kênh người bán
│       └── admin/      # trang quản trị
├── docs/thiet-ke/      # mockup HTML gốc + logo
├── docker-compose.yml
└── render.yaml         # Render Blueprint
```

## Chạy trên máy (development)

Yêu cầu: Node.js 20+, Docker Desktop.

```bash
# 1. CSDL + Redis (PostgreSQL map ra cổng 5433 để tránh trùng Postgres cài sẵn)
docker compose up -d postgres redis

# 2. Backend
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run db:seed          # dữ liệu mẫu
npm run start:dev        # http://localhost:4000/api

# 3. Frontend (terminal khác)
cd frontend
cp .env.example .env.local
npm install
npm run dev              # http://localhost:3000
```

Hoặc chạy toàn bộ bằng Docker: `docker compose up --build` (sau đó seed: `docker compose exec backend npm run db:seed`).

### Tài khoản mẫu (mật khẩu `123456`)

| Vai trò | Email |
|---|---|
| Người mua | `an@giatot.vn` |
| Người bán (Lumen Audio) | `lumen@giatot.vn` |
| Quản trị | `admin@giatot.vn` |

Mã voucher mẫu: `GIATOT50K`, `FREESHIP`, `GIAM40K`, `LUMEN50`, `NORA30`.

## Tích hợp VNPay Sandbox

1. Đăng ký tài khoản test tại <https://sandbox.vnpayment.vn/devreg/> để nhận `vnp_TmnCode` và `vnp_HashSecret`.
2. Điền vào `backend/.env`: `VNP_TMN_CODE`, `VNP_HASH_SECRET`, `VNP_RETURN_URL=<frontend>/payment/vnpay-return`.
3. Luồng: `POST /api/checkout` (paymentMethod `VNPAY`) → trả về `paymentUrl` đã ký HMAC-SHA512 → người dùng thanh toán → VNPay chuyển về `/payment/vnpay-return` → frontend gọi `GET /api/payments/vnpay/return` để xác thực chữ ký và cập nhật đơn.
4. **IPN** (server-to-server): khai báo URL `https://<api>/api/payments/vnpay/ipn` trong trang quản lý merchant sandbox. Xử lý idempotent, trả `RspCode` theo chuẩn VNPay.
5. Thẻ test: ngân hàng **NCB**, số thẻ `9704198526191432198`, tên `NGUYEN VAN A`, ngày phát hành `07/15`, OTP `123456`.

## Tích hợp GHN (Giao Hàng Nhanh)

- Môi trường dev: <https://5sao.ghn.dev> → lấy **Token** và **ShopId**, điền `GHN_TOKEN`, `GHN_SHOP_ID`.
- API dùng: danh mục tỉnh/quận/phường (`/master-data/*`), tính phí (`/v2/shipping-order/fee`), tạo vận đơn khi người bán xác nhận (`/v2/shipping-order/create`), tra cứu (`/v2/shipping-order/detail`), hủy (`/v2/switch-status/cancel`).
- Webhook trạng thái: `POST /api/shipping/ghn/webhook` (cấu hình trong trang GHN) tự chuyển đơn sang *Đang giao* / *Hoàn thành*.
- **Chưa có token?** Backend tự chạy **chế độ giả lập** (dữ liệu địa chính mẫu, phí ship ước tính, mã vận đơn `GHNMOCK...`) để demo đầy đủ luồng. Khi bật GHN thật, người bán cần cập nhật `District ID / Ward Code` lấy hàng trong *Cài đặt shop* và người mua tạo lại địa chỉ.

## Redis

Dùng làm cache cho trang chủ, danh mục, kết quả tìm kiếm, chi tiết sản phẩm và danh mục địa chính GHN; tự xóa cache khi sản phẩm/kho/banner thay đổi. Nếu không cấu hình `REDIS_URL`, API vẫn chạy với cache trong bộ nhớ.

## Triển khai

### Backend + PostgreSQL + Redis → Render
1. Render Dashboard → **New → Blueprint** → chọn repo này (đọc `render.yaml`).
2. Điền các biến `sync: false`: `FRONTEND_URL` (domain Vercel), `VNP_*`, `GHN_*`.
3. Container tự chạy `prisma migrate deploy` khi khởi động. Seed dữ liệu (tùy chọn) từ Shell của service: `npm run db:seed`.

### Frontend → Vercel
1. Import repo trên Vercel, **Root Directory = `frontend`** (Framework: Next.js).
2. Environment Variable: `NEXT_PUBLIC_API_URL=https://<ten-api>.onrender.com/api`.
3. Cập nhật lại `FRONTEND_URL` và `VNP_RETURN_URL` trên Render theo domain Vercel.

## API chính

| Nhóm | Endpoint |
|---|---|
| Xác thực | `POST /auth/register`, `POST /auth/login`, `GET/PATCH /auth/me` |
| Danh mục | `GET /home`, `GET /categories`, `GET /products?q=&categoryId=&sort=`, `GET /products/:id`, `GET /shops/:id` |
| Người mua | `/cart`, `/addresses`, `/wishlist`, `/vouchers`, `/check-in`, `/notifications` |
| Đặt hàng | `POST /checkout/quote`, `POST /checkout`, `GET /orders`, `POST /orders/:id/{cancel,received,pay,return}`, `POST /reviews` |
| Thanh toán | `GET /payments/vnpay/return`, `GET /payments/vnpay/ipn` |
| Vận chuyển | `GET /shipping/{provinces,districts,wards}`, `POST /shipping/fee`, `POST /shipping/ghn/webhook` |
| Người bán | `/seller/{overview,products,orders,vouchers,finance,analytics,shop}` |
| Quản trị | `/admin/{overview,shops,users,categories,products,vouchers,returns,banners,reports}` |
