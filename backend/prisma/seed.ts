/* Dữ liệu mẫu cho Giá Tốt. Chạy: npm run db:seed (xóa sạch dữ liệu cũ trước khi tạo). */
import { Brand, Category, PrismaClient, Product, Shop } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const img = (seed: string | number) => `https://picsum.photos/seed/giatot-${seed}/600/600`;
const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const CATEGORIES: [string, string[], string[]][] = [
  ['Thời trang nam', ['Áo thun', 'Áo sơ mi', 'Quần', 'Áo khoác', 'Giày', 'Phụ kiện'], ['Nova', 'Urban', 'Kite', 'Mono', 'Pulse', 'Arc']],
  ['Thời trang nữ', ['Giày', 'Túi', 'Váy'], ['Lina', 'Oka', 'Mira', 'Selene', 'Vivi', 'Rose']],
  ['Điện thoại & Phụ kiện', ['Tai nghe', 'Ốp lưng', 'Sạc'], ['Lumen', 'Zenix', 'Orbit', 'Volt', 'Tano', 'Pixel']],
  ['Máy tính', ['Balo', 'Bàn phím', 'Chuột'], ['Byte', 'Kore', 'Nexa', 'Hexa', 'Lumo', 'Aero']],
  ['Nhà cửa', ['Bình', 'Đèn', 'Gia dụng'], ['Kito', 'Homa', 'Soho', 'Luma', 'Nest', 'Zen']],
  ['Sắc đẹp', ['Serum', 'Son', 'Sữa rửa mặt'], ['Pure', 'Glow', 'Dewy', 'Aqua', 'Bloom', 'Leaf']],
  ['Mẹ & bé', ['Sữa', 'Tã', 'Đồ chơi'], ['Tiny', 'Baby', 'Mimi', 'Kiddo', 'Cuddle', 'Moon']],
  ['Thể thao', ['Giày thể thao', 'Yoga', 'Bình nước'], ['Vento', 'Fit', 'Run', 'Peak', 'Flex', 'Pro']],
  ['Thực phẩm', ['Đồ khô', 'Đồ uống', 'Bánh kẹo'], ['Green', 'Farm', 'Tasty', 'Sun', 'Fresh', 'Mama']],
  ['Sách', ['Văn học', 'Kỹ năng', 'Thiếu nhi'], ['Paper', 'Lotus', 'Ink', 'Page', 'Story', 'Tree']],
];

// [tên shop, email, thành phố, districtId, wardCode, mall]
const SHOPS: [string, string, string, number, string, boolean][] = [
  ['Lumen Audio', 'lumen@giatot.vn', 'TP. Hồ Chí Minh', 1442, '144201', true],
  ['Nora Wear', 'nora@giatot.vn', 'Hà Nội', 1489, '148901', true],
  ['Kito Home', 'kito@giatot.vn', 'Đà Nẵng', 1526, '152601', true],
  ['Pure Skin', 'pure@giatot.vn', 'TP. Hồ Chí Minh', 1444, '144401', true],
  ['Vento Sport', 'vento@giatot.vn', 'Cần Thơ', 1572, '157201', true],
  ['Tiny Steps', 'tiny@giatot.vn', 'Hà Nội', 1493, '149301', false],
  ['Paperlane', 'paper@giatot.vn', 'Vĩnh Long', 1560, '156001', false],
  ['Bean & Co', 'bean@giatot.vn', 'Đà Nẵng', 1527, '152701', false],
];

// [tên, shop index, danh mục index, sub index, brand index, giá, giá gốc, kho, đã bán, flash, freeShip]
const PRODUCTS: [string, number, number, number, number, number, number | null, number, number, boolean, boolean][] = [
  ['Tai nghe không dây chống ồn Lumen Pro', 0, 2, 0, 0, 489000, 690000, 128, 1240, true, true],
  ['Loa bluetooth mini chống nước', 0, 2, 0, 0, 359000, 450000, 6, 860, false, true],
  ['Tai nghe in-ear có dây bass mạnh', 0, 2, 0, 1, 129000, 159000, 0, 2310, false, false],
  ['Sạc nhanh 20W USB-C chính hãng', 0, 2, 2, 3, 159000, 220000, 342, 3120, true, true],
  ['Ốp lưng điện thoại trong suốt chống sốc', 0, 2, 1, 5, 49000, 79000, 900, 5400, true, false],
  ['Bàn phím cơ không dây 75%', 0, 3, 1, 0, 899000, 1090000, 54, 410, false, true],
  ['Chuột không dây yên tĩnh', 0, 3, 2, 1, 199000, 259000, 210, 1890, true, true],
  ['Balo laptop chống nước 15.6 inch', 0, 3, 0, 5, 329000, 450000, 77, 760, false, true],
  ['Áo thun cotton form rộng unisex', 1, 1, 2, 0, 129000, 199000, 500, 4200, true, false],
  ['Áo thun nam cổ tròn basic', 1, 0, 0, 0, 99000, 149000, 640, 5320, true, false],
  ['Áo sơ mi nam dài tay công sở', 1, 0, 1, 1, 259000, 320000, 180, 980, false, true],
  ['Quần jean nam ống đứng', 1, 0, 2, 2, 349000, 420000, 140, 1320, false, true],
  ['Áo khoác gió nam hai lớp', 1, 0, 3, 3, 329000, 450000, 95, 870, true, true],
  ['Quần short kaki nam', 1, 0, 2, 4, 189000, 230000, 260, 1540, false, false],
  ['Áo polo nam phối viền', 1, 0, 0, 5, 219000, 279000, 300, 2100, false, true],
  ['Giày sneaker nam trắng', 1, 0, 4, 0, 459000, 590000, 66, 690, false, true],
  ['Thắt lưng da nam khóa tự động', 1, 0, 5, 1, 179000, 250000, 150, 1120, false, false],
  ['Túi tote vải canvas', 1, 1, 1, 1, 89000, 120000, 420, 3380, true, false],
  ['Váy hoa dáng xòe vintage', 1, 1, 2, 2, 279000, 350000, 88, 640, false, true],
  ['Bình giữ nhiệt inox 500ml', 2, 4, 0, 0, 189000, 249000, 300, 2780, true, true],
  ['Đèn bàn LED cảm ứng 3 chế độ', 2, 4, 1, 1, 215000, 290000, 120, 1630, false, true],
  ['Nồi chiên không dầu 5L', 2, 4, 2, 2, 1190000, 1590000, 40, 380, true, true],
  ['Bộ hộp đựng thực phẩm thủy tinh', 2, 4, 2, 4, 245000, 299000, 160, 920, false, false],
  ['Serum dưỡng ẩm Hyaluronic 30ml', 3, 5, 0, 0, 245000, 320000, 260, 3010, true, true],
  ['Son kem lì mềm môi', 3, 5, 1, 1, 159000, 199000, 380, 4120, false, false],
  ['Sữa rửa mặt dịu nhẹ 150ml', 3, 5, 2, 3, 129000, 165000, 420, 3560, false, true],
  ['Giày sneaker nữ đế êm', 4, 7, 0, 0, 459000, 620000, 74, 1210, true, true],
  ['Thảm yoga TPE chống trượt', 4, 7, 1, 1, 259000, 340000, 110, 830, false, true],
  ['Bình nước thể thao 1L', 4, 7, 2, 2, 99000, 139000, 500, 2650, false, false],
  ['Đồ chơi xếp hình gỗ cho bé', 5, 6, 2, 0, 189000, 239000, 150, 970, false, true],
  ['Tã quần siêu thấm size M', 5, 6, 1, 1, 269000, 310000, 200, 1840, true, true],
  ['Sữa bột dinh dưỡng 800g', 5, 6, 0, 2, 459000, 499000, 60, 720, false, true],
  ['Tiểu thuyết "Mùa hè xanh"', 6, 9, 0, 0, 98000, 120000, 300, 1430, false, false],
  ['Sách kỹ năng quản lý thời gian', 6, 9, 1, 1, 115000, 139000, 260, 1980, false, false],
  ['Truyện tranh thiếu nhi (bộ 5 cuốn)', 6, 9, 2, 2, 175000, 225000, 140, 860, true, true],
  ['Cà phê rang xay Cầu Đất 500g', 7, 8, 1, 0, 165000, 199000, 230, 2240, true, false],
  ['Hạt điều rang muối 500g', 7, 8, 0, 1, 189000, 230000, 180, 1560, false, true],
  ['Bánh quy bơ hộp thiếc', 7, 8, 2, 2, 129000, 159000, 260, 1290, false, false],
];

async function main() {
  console.log('Xóa dữ liệu cũ...');
  await prisma.$transaction([
    prisma.notification.deleteMany(), prisma.review.deleteMany(), prisma.returnRequest.deleteMany(), prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(), prisma.payment.deleteMany(), prisma.cartItem.deleteMany(), prisma.wishlist.deleteMany(),
    prisma.userVoucher.deleteMany(), prisma.voucher.deleteMany(), prisma.shopTransaction.deleteMany(), prisma.product.deleteMany(),
    prisma.brand.deleteMany(), prisma.category.deleteMany(), prisma.address.deleteMany(), prisma.shop.deleteMany(),
    prisma.banner.deleteMany(), prisma.user.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash('123456', 10);

  console.log('Tạo tài khoản...');
  await prisma.user.create({ data: { email: 'admin@giatot.vn', name: 'Quản trị viên', role: 'ADMIN', passwordHash } });
  const buyer = await prisma.user.create({ data: { email: 'an@giatot.vn', name: 'Nguyễn Văn An', phone: '0901234567', passwordHash, xu: 1200 } });
  const others = await Promise.all(
    [['Trần Thị Bình', 'binh@giatot.vn', '0912345678'], ['Lê Minh Chi', 'chi@giatot.vn', '0933456789'], ['Phạm Quốc Dũng', 'dung@giatot.vn', '0944567890'], ['Võ Thu Em', 'em@giatot.vn', '0955678901']].map(
      ([name, email, phone]) => prisma.user.create({ data: { name, email, phone, passwordHash } }),
    ),
  );
  await prisma.user.update({ where: { id: others[2].id }, data: { status: 'LOCKED' } });

  await prisma.address.createMany({
    data: [
      { userId: buyer.id, fullName: 'Nguyễn Văn An', phone: '0901234567', line: '12 Nguyễn Huệ', provinceId: 202, provinceName: 'Hồ Chí Minh', districtId: 1442, districtName: 'Quận 1', wardCode: '144201', wardName: 'Phường 1', isDefault: true },
      { userId: buyer.id, fullName: 'Nguyễn Văn An', phone: '0901234567', line: '45 Lê Lợi', provinceId: 203, provinceName: 'Đà Nẵng', districtId: 1526, districtName: 'Quận Hải Châu', wardCode: '152601', wardName: 'Phường 1' },
      ...others.map((o, i) => ({ userId: o.id, fullName: o.name, phone: o.phone!, line: `${i + 3} Trần Phú`, provinceId: 220, provinceName: 'Cần Thơ', districtId: 1572, districtName: 'Quận Ninh Kiều', wardCode: '157201', wardName: 'Phường 1', isDefault: true })),
    ],
  });

  console.log('Tạo danh mục và thương hiệu...');
  const cats: { c: Category; children: Category[]; brands: Brand[] }[] = [];
  for (const [i, [name, subs, brands]] of CATEGORIES.entries()) {
    const c = await prisma.category.create({ data: { name, slug: slug(name), sortOrder: i } });
    const children: Category[] = [];
    for (const [j, s] of subs.entries()) children.push(await prisma.category.create({ data: { name: s, slug: `${slug(name)}-${slug(s)}`, parentId: c.id, sortOrder: j } }));
    const bs: Brand[] = [];
    for (const b of brands) bs.push(await prisma.brand.create({ data: { name: b, categoryId: c.id } }));
    cats.push({ c, children, brands: bs });
  }

  console.log('Tạo cửa hàng...');
  const shops: Shop[] = [];
  for (const [i, [name, email, city, districtId, wardCode, isMall]] of SHOPS.entries()) {
    const owner = await prisma.user.create({ data: { email, name: `Chủ shop ${name}`, phone: `09080000${i}${i}`, passwordHash, role: 'SELLER' } });
    shops.push(
      await prisma.shop.create({
        data: {
          ownerId: owner.id, name, city, districtId, wardCode, isMall, status: 'APPROVED',
          description: `${name} - hàng chính hãng, giao nhanh toàn quốc.`,
          pickupAddress: `${10 + i} Đường số ${i + 1}, ${city}`, pickupPhone: `09080000${i}${i}`,
          followers: 12400 - i * 1300, rating: 4.9 - i * 0.05, balance: 4250000 - i * 300000,
          businessType: isMall ? 'Doanh nghiệp' : 'Cá nhân',
        },
      }),
    );
  }
  // Hồ sơ người bán chờ duyệt
  for (const [name, email, city, type, docs, status] of [
    ['Hoa Tươi Studio', 'hoatuoi@giatot.vn', 'Đà Nẵng', 'Cá nhân', 'CCCD, giấy phép kinh doanh', 'PENDING'],
    ['Gốm Bát Tràng An', 'gom@giatot.vn', 'Hà Nội', 'Hộ kinh doanh', 'CCCD, đăng ký hộ kinh doanh', 'PENDING'],
    ['TechNest', 'technest@giatot.vn', 'TP. Hồ Chí Minh', 'Doanh nghiệp', 'Giấy phép doanh nghiệp, ủy quyền thương hiệu', 'PENDING'],
    ['Shop Giá Rẻ 99', 'giare@giatot.vn', 'Cần Thơ', 'Cá nhân', 'CCCD không rõ nét', 'REJECTED'],
  ] as const) {
    const owner = await prisma.user.create({ data: { email, name: `Chủ ${name}`, passwordHash } });
    await prisma.shop.create({ data: { ownerId: owner.id, name, city, businessType: type, documents: docs, status, pickupAddress: city, pickupPhone: '0900000000' } });
  }

  console.log('Tạo sản phẩm...');
  const products: Product[] = [];
  for (const [k, [name, si, ci, sub, bi, price, orig, stock, sold, flash, freeShip]] of PRODUCTS.entries()) {
    const cat = cats[ci];
    products.push(
      await prisma.product.create({
        data: {
          name, shopId: shops[si].id, categoryId: cat.children[sub]?.id ?? cat.c.id, brandId: cat.brands[bi].id,
          price, originalPrice: orig, stock, sold, isFlashSale: flash, freeShip, status: 'APPROVED',
          rating: Math.round((4.3 + (k % 7) / 10) * 10) / 10, ratingCount: Math.round(sold / 3),
          images: [img(k), img(`${k}-b`), img(`${k}-c`), img(`${k}-d`)],
          weight: ci === 4 ? 1500 : ci === 9 ? 400 : 300,
          options: ci <= 1 ? [{ name: 'Màu sắc', values: ['Đen', 'Trắng', 'Xanh'] }, { name: 'Kích cỡ', values: ['S', 'M', 'L', 'XL'] }]
            : ci === 2 || ci === 3 ? [{ name: 'Màu sắc', values: ['Đen', 'Trắng'] }, { name: 'Phiên bản', values: ['Tiêu chuẩn', 'Cao cấp'] }] : undefined,
          description: `${name} chính hãng, bảo hành 12 tháng. Thiết kế gọn nhẹ, chất liệu bền, phù hợp sử dụng hằng ngày.\n\n- Đổi trả miễn phí trong 15 ngày\n- Đóng gói cẩn thận, giao hàng toàn quốc qua GHN\n- Hỗ trợ thanh toán COD và VNPay`,
        },
      }),
    );
  }
  // Sản phẩm chờ duyệt
  for (const [name, si, ci, price, flag] of [
    ['Tai nghe chống ồn Pro Max bản quốc tế', 0, 2, 890000, 'Chưa có giấy ủy quyền thương hiệu'],
    ['Serum vitamin C sáng da 30ml', 3, 5, 245000, null],
    ['Áo khoác dù nam chống nắng', 1, 0, 329000, null],
    ['Sạc nhanh 65W GaN ba cổng', 0, 2, 399000, 'Mô tả có từ khóa bị hạn chế'],
  ] as const) {
    await prisma.product.create({ data: { name, shopId: shops[si].id, categoryId: cats[ci].c.id, price, stock: 50, status: 'PENDING', flag, images: [img(name.length)] } });
  }

  console.log('Tạo voucher, banner...');
  const in60 = new Date(Date.now() + 60 * 86400_000);
  await prisma.voucher.createMany({
    data: [
      { code: 'GIATOT50K', name: 'Giảm 50.000đ', discount: 50000, minOrder: 300000, quantity: 20000, used: 12840, expiresAt: in60 },
      { code: 'FREESHIP', name: 'Miễn phí vận chuyển', kind: 'SHIPPING', discount: 30000, minOrder: 150000, quantity: 100000, used: 48210, expiresAt: in60 },
      { code: 'GIAM40K', name: 'Giảm 40.000đ đơn từ 200K', discount: 40000, minOrder: 200000, quantity: 5000, used: 1210, expiresAt: in60 },
      { code: 'BANMOI', name: 'Khách hàng mới giảm 20K', discount: 20000, minOrder: 0, quantity: 10000, used: 6120, active: false },
      { code: 'LUMEN50', name: 'Lumen Audio giảm 50K đơn từ 300K', scope: 'SHOP', shopId: shops[0].id, discount: 50000, minOrder: 300000, quantity: 500, used: 128 },
      { code: 'LUMEN20', name: 'Lumen Audio giảm 20K đơn từ 150K', scope: 'SHOP', shopId: shops[0].id, discount: 20000, minOrder: 150000, quantity: 1000, used: 342 },
      { code: 'NORA30', name: 'Nora Wear giảm 30K', scope: 'SHOP', shopId: shops[1].id, discount: 30000, minOrder: 250000, quantity: 300, used: 41 },
    ],
  });
  await prisma.banner.createMany({
    data: [
      { title: 'Siêu sale 11.11 · Giảm đến 50%', subtitle: 'Săn deal mỗi khung giờ', position: 0, link: '/search?sort=bestseller' },
      { title: 'Giá Tốt Mall: thương hiệu chính hãng', subtitle: 'Ưu đãi đến 40%', position: 1, link: '/search?mall=1' },
      { title: 'Miễn phí vận chuyển toàn quốc', subtitle: 'Đơn từ 150.000đ', position: 2, link: '/vouchers' },
    ],
  });

  console.log('Tạo đơn hàng mẫu...');
  const mk = async (buyerId: number, si: number, pis: number[], status: 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED' | 'PENDING_PAYMENT', daysAgo: number, method: 'COD' | 'VNPAY' = 'COD') => {
    const items = pis.map((i) => products[i]);
    const subtotal = items.reduce((a, p) => a + p.price, 0);
    const shippingFee = 22000;
    const addr = await prisma.address.findFirstOrThrow({ where: { userId: buyerId } });
    return prisma.order.create({
      data: {
        code: `GT2610${String(Math.floor(Math.random() * 9000) + 1000)}${si}`,
        buyerId, shopId: shops[si].id, status, paymentMethod: method,
        paymentStatus: status === 'COMPLETED' || method === 'VNPAY' && status !== 'PENDING_PAYMENT' ? 'PAID' : 'UNPAID',
        subtotal, shippingFee, total: subtotal + shippingFee,
        shipName: addr.fullName, shipPhone: addr.phone, shipAddress: `${addr.line}, ${addr.wardName}, ${addr.districtName}, ${addr.provinceName}`,
        toDistrictId: addr.districtId, toWardCode: addr.wardCode,
        ghnOrderCode: ['CONFIRMED', 'SHIPPING', 'COMPLETED'].includes(status) ? `GHNMOCK${Math.floor(Math.random() * 900000)}` : null,
        createdAt: new Date(Date.now() - daysAgo * 86400_000),
        items: { create: items.map((p) => ({ productId: p.id, name: p.name, image: p.images[0], price: p.price, qty: 1 })) },
      },
    });
  };
  await mk(buyer.id, 0, [0], 'SHIPPING', 2, 'VNPAY');
  const done = await mk(buyer.id, 2, [19, 20], 'COMPLETED', 6);
  await mk(buyer.id, 1, [8], 'PENDING_PAYMENT', 1, 'VNPAY');
  const ret = await mk(buyer.id, 4, [26], 'COMPLETED', 12);
  await mk(others[0].id, 0, [3, 3], 'PENDING', 0);
  await mk(others[1].id, 0, [1], 'CONFIRMED', 1);
  await mk(others[3].id, 0, [5], 'SHIPPING', 3);
  await mk(others[0].id, 0, [2], 'COMPLETED', 5);
  await mk(others[1].id, 1, [9, 10], 'COMPLETED', 4);
  await mk(others[3].id, 3, [23], 'COMPLETED', 1);
  await mk(others[0].id, 0, [6], 'CANCELLED', 2);
  void done;

  await prisma.returnRequest.create({
    data: { code: 'KN-1042', orderId: ret.id, userId: buyer.id, reason: 'Hàng không đúng mô tả', description: 'Giày rộng hơn size đặt, đã có ảnh kèm theo.', amount: ret.total },
  });
  await prisma.shopTransaction.createMany({
    data: [
      { shopId: shops[0].id, type: 'SETTLEMENT', amount: 342000, status: 'Đã về ví', note: 'Đối soát đơn GT26100009' },
      { shopId: shops[0].id, type: 'WITHDRAW', amount: -3000000, status: 'Hoàn tất', note: 'Rút tiền về ngân hàng' },
      { shopId: shops[0].id, type: 'FEE', amount: -1190000, status: 'Đã trừ', note: 'Phí sàn tháng 9' },
    ],
  });
  await prisma.wishlist.createMany({ data: [1, 3, 5].map((i) => ({ userId: buyer.id, productId: products[i].id })) });
  await prisma.cartItem.createMany({
    data: [{ userId: buyer.id, productId: products[1].id, qty: 1 }, { userId: buyer.id, productId: products[4].id, qty: 2 }, { userId: buyer.id, productId: products[7].id, qty: 1, selected: false }],
  });
  await prisma.notification.createMany({
    data: [
      { userId: buyer.id, type: 'ORDER', title: 'Đơn hàng đang giao', body: 'Đơn của bạn đã rời kho TP. HCM, dự kiến giao trong 2 ngày.' },
      { userId: buyer.id, type: 'PROMO', title: 'Siêu sale 11.11', body: 'Voucher giảm đến 50K đang chờ bạn lưu.' },
      { userId: buyer.id, type: 'SYSTEM', title: 'Cập nhật điều khoản', body: 'Điều khoản dịch vụ có hiệu lực từ 01/01/2026.', read: true },
    ],
  });

  console.log('Hoàn tất! Tài khoản mẫu (mật khẩu 123456): admin@giatot.vn, lumen@giatot.vn (người bán), an@giatot.vn (người mua)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
