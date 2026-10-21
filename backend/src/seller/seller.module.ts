import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, ParseIntPipe, Patch, Post, Put, Query,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/auth';
import { makeCode, PLATFORM_FEE_RATE, toInt } from '../common/utils';
import { OrdersModule, OrdersService } from '../orders/orders.module';
import { PrismaService } from '../prisma/prisma.service';

class RegisterShopDto {
  @IsString() @MinLength(3) name!: string;
  @IsString() @MinLength(5) pickupAddress!: string;
  @IsString() @MinLength(8) pickupPhone!: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsInt() districtId?: number;
  @IsOptional() @IsString() wardCode?: string;
  @IsOptional() @IsString() businessType?: string;
  @IsOptional() @IsString() idNumber?: string;
  @IsOptional() @IsString() documents?: string;
  @IsOptional() @IsString() description?: string;
}

class ProductDto {
  @IsString() @MinLength(10, { message: 'Tên sản phẩm tối thiểu 10 ký tự' }) name!: string;
  @IsInt() categoryId!: number;
  @IsOptional() @IsInt() brandId?: number | null;
  @IsOptional() @IsString() description?: string;
  @IsInt() @Min(1000) price!: number;
  @IsOptional() @IsInt() originalPrice?: number | null;
  @IsInt() @Min(0) stock!: number;
  @IsOptional() @IsInt() @Min(50) weight?: number;
  @IsOptional() @IsArray() images?: string[];
  @IsOptional() @IsArray() options?: { name: string; values: string[] }[];
  @IsOptional() @IsBoolean() freeShip?: boolean;
}

class VoucherDto {
  @IsString() @MinLength(3) name!: string;
  @IsInt() @Min(1000) discount!: number;
  @IsOptional() @IsInt() @Min(0) minOrder?: number;
  @IsOptional() @IsInt() @Min(1) quantity?: number;
  @IsOptional() @IsString() kind?: 'DISCOUNT' | 'SHIPPING';
}

class ShopSettingsDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() logo?: string;
  @IsOptional() @IsString() cover?: string;
  @IsOptional() @IsString() pickupAddress?: string;
  @IsOptional() @IsString() pickupPhone?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsInt() districtId?: number;
  @IsOptional() @IsString() wardCode?: string;
  @IsOptional() @IsBoolean() vacationMode?: boolean;
  @IsOptional() @IsBoolean() autoReply?: boolean;
  @IsOptional() @IsBoolean() acceptReturn?: boolean;
  @IsOptional() @IsBoolean() fastShipping?: boolean;
}

const DAY = 86400_000;

@Injectable()
export class SellerService {
  constructor(private prisma: PrismaService, private orders: OrdersService) {}

  private shopId(u: AuthUser) {
    if (!u.shopId) throw new ForbiddenException('Bạn chưa đăng ký bán hàng');
    return u.shopId;
  }

  async register(u: AuthUser, dto: RegisterShopDto) {
    if (u.shopId) throw new BadRequestException('Bạn đã đăng ký cửa hàng');
    const shop = await this.prisma.shop.create({ data: { ...dto, ownerId: u.id, status: 'PENDING' } });
    const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN' } });
    for (const a of admins) await this.orders.notify(a.id, 'Hồ sơ người bán mới', `${shop.name} vừa gửi hồ sơ đăng ký bán hàng.`, 'SYSTEM');
    return shop;
  }

  shop(u: AuthUser) {
    return this.prisma.shop.findUniqueOrThrow({ where: { id: this.shopId(u) } });
  }

  async updateShop(u: AuthUser, dto: ShopSettingsDto) {
    const shop = await this.prisma.shop.update({ where: { id: this.shopId(u) }, data: dto });
    await this.orders.invalidateCatalog();
    return shop;
  }

  async overview(u: AuthUser) {
    const shopId = this.shopId(u);
    const since = new Date(Date.now() - 7 * DAY);
    const [byStatus, recent, products, outOfStock, pendingReturns, shop] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], where: { shopId }, _count: true }),
      this.prisma.order.findMany({ where: { shopId, createdAt: { gte: since }, status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] } }, select: { subtotal: true, createdAt: true } }),
      this.prisma.product.count({ where: { shopId } }),
      this.prisma.product.count({ where: { shopId, stock: 0 } }),
      this.prisma.returnRequest.count({ where: { order: { shopId }, status: 'PENDING' } }),
      this.prisma.shop.findUniqueOrThrow({ where: { id: shopId } }),
    ]);
    const count = (s: OrderStatus) => byStatus.find((b) => b.status === s)?._count ?? 0;
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * DAY);
      const key = d.toDateString();
      const revenue = recent.filter((o) => o.createdAt.toDateString() === key).reduce((a, o) => a + o.subtotal, 0);
      return { label: `${d.getDate()}/${d.getMonth() + 1}`, revenue };
    });
    return {
      shop: { id: shop.id, name: shop.name, status: shop.status, balance: shop.balance },
      revenueToday: days[6].revenue,
      revenue7d: days.reduce((a, d) => a + d.revenue, 0),
      ordersTotal: byStatus.reduce((a, b) => a + b._count, 0),
      products,
      days,
      todos: { pending: count('PENDING'), confirmed: count('CONFIRMED'), outOfStock, returns: pendingReturns },
    };
  }

  // ---------- Sản phẩm ----------
  products(u: AuthUser, q?: string) {
    return this.prisma.product.findMany({
      where: { shopId: this.shopId(u), ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { category: { select: { name: true } } },
    });
  }

  async product(u: AuthUser, id: number) {
    const p = await this.prisma.product.findFirst({ where: { id, shopId: this.shopId(u) } });
    if (!p) throw new NotFoundException('Không tìm thấy sản phẩm');
    return p;
  }

  async createProduct(u: AuthUser, dto: ProductDto) {
    const p = await this.prisma.product.create({
      data: {
        ...dto,
        options: (dto.options ?? undefined) as Prisma.InputJsonValue | undefined,
        images: dto.images?.filter(Boolean) ?? [],
        shopId: this.shopId(u),
        status: 'PENDING',
      },
    });
    return p;
  }

  async updateProduct(u: AuthUser, id: number, dto: ProductDto) {
    const p = await this.product(u, id);
    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
        options: (dto.options ?? undefined) as Prisma.InputJsonValue | undefined,
        images: dto.images?.filter(Boolean) ?? p.images,
        status: p.status === 'REJECTED' ? 'PENDING' : p.status,
      },
    });
    await this.orders.invalidateCatalog();
    return updated;
  }

  async toggleProduct(u: AuthUser, id: number) {
    const p = await this.product(u, id);
    const updated = await this.prisma.product.update({ where: { id }, data: { visible: !p.visible } });
    await this.orders.invalidateCatalog();
    return updated;
  }

  async deleteProduct(u: AuthUser, id: number) {
    await this.product(u, id);
    const used = await this.prisma.orderItem.count({ where: { productId: id } });
    if (used) {
      await this.prisma.product.update({ where: { id }, data: { visible: false, stock: 0 } });
    } else {
      await this.prisma.product.delete({ where: { id } });
    }
    await this.orders.invalidateCatalog();
    return { ok: true, hidden: !!used };
  }

  // ---------- Đơn hàng ----------
  async orderList(u: AuthUser, status?: string) {
    const shopId = this.shopId(u);
    const where: Prisma.OrderWhereInput = { shopId, status: { not: 'PENDING_PAYMENT' } };
    if (status && status in OrderStatus) where.status = status as OrderStatus;
    const [orders, counts] = await Promise.all([
      this.prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, include: { items: true, buyer: { select: { name: true } }, returnRequest: true } }),
      this.prisma.order.groupBy({ by: ['status'], where: { shopId }, _count: true }),
    ]);
    return { orders, counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) };
  }

  async orderDetail(u: AuthUser, id: number) {
    const o = await this.prisma.order.findFirst({
      where: { id, shopId: this.shopId(u) },
      include: { items: true, buyer: { select: { name: true, email: true } }, returnRequest: true },
    });
    if (!o) throw new NotFoundException('Không tìm thấy đơn hàng');
    const fee = Math.round(o.subtotal * PLATFORM_FEE_RATE);
    return { ...o, platformFee: fee, net: o.subtotal - o.shopDiscount - fee };
  }

  async acceptReturn(u: AuthUser, returnId: number) {
    const r = await this.prisma.returnRequest.findFirst({ where: { id: returnId, order: { shopId: this.shopId(u) } }, include: { order: true } });
    if (!r || r.status !== 'PENDING') throw new BadRequestException('Yêu cầu không hợp lệ');
    await resolveReturn(this.prisma, this.orders, r.id, true);
    return { ok: true };
  }

  // ---------- Voucher của shop ----------
  vouchers(u: AuthUser) {
    return this.prisma.voucher.findMany({ where: { shopId: this.shopId(u) }, orderBy: { createdAt: 'desc' } });
  }

  createVoucher(u: AuthUser, dto: VoucherDto) {
    return this.prisma.voucher.create({
      data: {
        code: makeCode('SHOP'),
        name: dto.name,
        scope: 'SHOP',
        kind: dto.kind === 'SHIPPING' ? 'SHIPPING' : 'DISCOUNT',
        shopId: this.shopId(u),
        discount: dto.discount,
        minOrder: dto.minOrder ?? 0,
        quantity: dto.quantity ?? 100,
      },
    });
  }

  async updateVoucher(u: AuthUser, id: number, dto: Partial<VoucherDto> & { active?: boolean }) {
    const v = await this.prisma.voucher.findFirst({ where: { id, shopId: this.shopId(u) } });
    if (!v) throw new NotFoundException('Không tìm thấy voucher');
    return this.prisma.voucher.update({
      where: { id },
      data: { name: dto.name, discount: dto.discount, minOrder: dto.minOrder, quantity: dto.quantity, active: dto.active },
    });
  }

  async deleteVoucher(u: AuthUser, id: number) {
    await this.prisma.voucher.deleteMany({ where: { id, shopId: this.shopId(u) } });
    return { ok: true };
  }

  // ---------- Tài chính ----------
  async finance(u: AuthUser) {
    const shopId = this.shopId(u);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [shop, pending, monthOrders, txs] = await Promise.all([
      this.prisma.shop.findUniqueOrThrow({ where: { id: shopId } }),
      this.prisma.order.aggregate({ where: { shopId, status: { in: ['PENDING', 'CONFIRMED', 'SHIPPING'] } }, _sum: { subtotal: true } }),
      this.prisma.order.aggregate({ where: { shopId, status: 'COMPLETED', updatedAt: { gte: monthStart } }, _sum: { subtotal: true } }),
      this.prisma.shopTransaction.findMany({ where: { shopId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    return {
      balance: shop.balance,
      pendingSettlement: pending._sum.subtotal ?? 0,
      feeThisMonth: Math.round((monthOrders._sum.subtotal ?? 0) * PLATFORM_FEE_RATE),
      feeRate: PLATFORM_FEE_RATE,
      transactions: txs,
    };
  }

  async withdraw(u: AuthUser) {
    const shop = await this.prisma.shop.findUniqueOrThrow({ where: { id: this.shopId(u) } });
    if (shop.balance <= 0) throw new BadRequestException('Số dư không đủ để rút');
    await this.prisma.$transaction([
      this.prisma.shop.update({ where: { id: shop.id }, data: { balance: 0 } }),
      this.prisma.shopTransaction.create({ data: { shopId: shop.id, type: 'WITHDRAW', amount: -shop.balance, status: 'Đang xử lý', note: 'Rút tiền về tài khoản ngân hàng' } }),
    ]);
    return { ok: true, amount: shop.balance };
  }

  // ---------- Phân tích ----------
  async analytics(u: AuthUser, rangeDays: number) {
    const shopId = this.shopId(u);
    const since = new Date(Date.now() - rangeDays * DAY);
    const prevSince = new Date(Date.now() - 2 * rangeDays * DAY);
    const valid = { notIn: ['CANCELLED', 'PENDING_PAYMENT'] as OrderStatus[] };
    const [cur, prev, items, buyers] = await Promise.all([
      this.prisma.order.aggregate({ where: { shopId, createdAt: { gte: since }, status: valid }, _sum: { subtotal: true }, _count: true }),
      this.prisma.order.aggregate({ where: { shopId, createdAt: { gte: prevSince, lt: since }, status: valid }, _sum: { subtotal: true }, _count: true }),
      this.prisma.orderItem.groupBy({
        by: ['productId', 'name'],
        where: { order: { shopId, createdAt: { gte: since }, status: valid } },
        _sum: { qty: true, price: true },
        orderBy: { _sum: { qty: 'desc' } },
        take: 5,
      }),
      this.prisma.order.groupBy({ by: ['buyerId'], where: { shopId, createdAt: { gte: since }, status: valid } }),
    ]);
    const revenue = cur._sum.subtotal ?? 0;
    const prevRevenue = prev._sum.subtotal ?? 0;
    const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);
    const topRows = await Promise.all(
      items.map(async (i) => {
        const rows = await this.prisma.orderItem.findMany({ where: { productId: i.productId, order: { shopId, createdAt: { gte: since }, status: valid } }, select: { price: true, qty: true } });
        return { productId: i.productId, name: i.name, qty: i._sum.qty ?? 0, revenue: rows.reduce((a, r) => a + r.price * r.qty, 0) };
      }),
    );
    return {
      revenue, revenueChange: pct(revenue, prevRevenue),
      orders: cur._count, ordersChange: pct(cur._count, prev._count),
      buyers: buyers.length,
      avgOrder: cur._count ? Math.round(revenue / cur._count) : 0,
      top: topRows,
    };
  }
}

/** Dùng chung cho người bán (chấp nhận) và quản trị (phân xử) khiếu nại trả hàng. */
export async function resolveReturn(prisma: PrismaService, orders: OrdersService, returnId: number, refund: boolean) {
  const r = await prisma.returnRequest.findUniqueOrThrow({ where: { id: returnId }, include: { order: true } });
  if (r.status !== 'PENDING') throw new BadRequestException('Khiếu nại đã được xử lý');
  await prisma.returnRequest.update({ where: { id: r.id }, data: { status: refund ? 'REFUNDED' : 'REJECTED', resolvedAt: new Date() } });
  if (refund) {
    await prisma.order.update({ where: { id: r.orderId }, data: { paymentStatus: 'REFUNDED' } });
    // Nếu tiền đã đối soát cho người bán thì trừ lại.
    if (r.order.status === 'COMPLETED') {
      const fee = Math.round(r.order.subtotal * PLATFORM_FEE_RATE);
      const net = r.order.subtotal - r.order.shopDiscount - fee;
      await prisma.$transaction([
        prisma.shop.update({ where: { id: r.order.shopId }, data: { balance: { decrement: net } } }),
        prisma.shopTransaction.create({ data: { shopId: r.order.shopId, type: 'FEE', amount: -net, status: 'Đã trừ', note: `Hoàn tiền trả hàng đơn ${r.order.code}` } }),
      ]);
    }
  }
  await orders.notify(
    r.userId,
    refund ? 'Yêu cầu trả hàng được chấp nhận' : 'Yêu cầu trả hàng bị từ chối',
    refund ? `Đơn ${r.order.code}: ${r.amount.toLocaleString('vi-VN')}đ sẽ được hoàn về tài khoản của bạn.` : `Đơn ${r.order.code}: khiếu nại không được chấp nhận.`,
  );
}

@Controller('seller')
export class SellerController {
  constructor(private s: SellerService, private orders: OrdersService) {}

  @Post('register') register(@CurrentUser() u: AuthUser, @Body() dto: RegisterShopDto) { return this.s.register(u, dto); }
  @Get('shop') shop(@CurrentUser() u: AuthUser) { return this.s.shop(u); }
  @Patch('shop') updateShop(@CurrentUser() u: AuthUser, @Body() dto: ShopSettingsDto) { return this.s.updateShop(u, dto); }
  @Get('overview') overview(@CurrentUser() u: AuthUser) { return this.s.overview(u); }

  @Get('products') products(@CurrentUser() u: AuthUser, @Query('q') q?: string) { return this.s.products(u, q); }
  @Get('products/:id') product(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.s.product(u, id); }
  @Post('products') create(@CurrentUser() u: AuthUser, @Body() dto: ProductDto) { return this.s.createProduct(u, dto); }
  @Put('products/:id') update(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ProductDto) { return this.s.updateProduct(u, id, dto); }
  @Post('products/:id/toggle') toggle(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.s.toggleProduct(u, id); }
  @Delete('products/:id') remove(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.s.deleteProduct(u, id); }

  @Get('orders') orderList(@CurrentUser() u: AuthUser, @Query('status') status?: string) { return this.s.orderList(u, status); }
  @Get('orders/:id') orderDetail(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.s.orderDetail(u, id); }
  @Post('orders/:id/confirm') confirm(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.orders.sellerConfirm(this.orders.assertShop(u), id); }
  @Post('orders/:id/handover') handover(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.orders.sellerHandover(this.orders.assertShop(u), id); }
  @Post('orders/:id/delivered') delivered(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.orders.sellerDelivered(this.orders.assertShop(u), id); }
  @Post('orders/:id/cancel') cancel(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body('reason') reason?: string) {
    return this.orders.cancel(id, reason || 'Người bán hủy đơn', { shopId: this.orders.assertShop(u) });
  }
  @Post('returns/:id/accept') acceptReturn(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.s.acceptReturn(u, id); }

  @Get('vouchers') vouchers(@CurrentUser() u: AuthUser) { return this.s.vouchers(u); }
  @Post('vouchers') createVoucher(@CurrentUser() u: AuthUser, @Body() dto: VoucherDto) { return this.s.createVoucher(u, dto); }
  @Patch('vouchers/:id') updateVoucher(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: Partial<VoucherDto> & { active?: boolean }) { return this.s.updateVoucher(u, id, dto); }
  @Delete('vouchers/:id') deleteVoucher(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.s.deleteVoucher(u, id); }

  @Get('finance') finance(@CurrentUser() u: AuthUser) { return this.s.finance(u); }
  @Post('finance/withdraw') withdraw(@CurrentUser() u: AuthUser) { return this.s.withdraw(u); }
  @Get('analytics') analytics(@CurrentUser() u: AuthUser, @Query('range') range?: string) { return this.s.analytics(u, [1, 7, 30].includes(toInt(range, 7)) ? toInt(range, 7) : 7); }
}

@Module({ imports: [OrdersModule], controllers: [SellerController], providers: [SellerService] })
export class SellerModule {}
