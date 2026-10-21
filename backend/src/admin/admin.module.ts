import {
  BadRequestException, Body, Controller, Delete, Get, Header, Injectable, Module, Param, ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApprovalStatus, Prisma, ReturnStatus } from '@prisma/client';
import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Roles } from '../common/auth';
import { makeCode, PLATFORM_FEE_RATE, slugify, toInt } from '../common/utils';
import { OrdersModule, OrdersService } from '../orders/orders.module';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { resolveReturn } from '../seller/seller.module';

class CategoryDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsInt() parentId?: number;
}

class CategoryPatchDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsBoolean() visible?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

class VoucherDto {
  @IsString() @MinLength(3) name!: string;
  @IsOptional() @IsString() code?: string;
  @IsInt() @Min(1000) discount!: number;
  @IsOptional() @IsInt() minOrder?: number;
  @IsOptional() @IsInt() quantity?: number;
  @IsOptional() @IsString() kind?: 'DISCOUNT' | 'SHIPPING';
  @IsOptional() @IsString() expiresAt?: string;
}

class BannerDto {
  @IsString() @MinLength(3) title!: string;
  @IsOptional() @IsString() subtitle?: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsString() link?: string;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
}

const DAY = 86400_000;
const VALID: Prisma.EnumOrderStatusFilter = { notIn: ['CANCELLED', 'PENDING_PAYMENT'] };

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private orders: OrdersService, private cache: CacheService) {}

  private async bust() {
    await Promise.all([this.cache.delByPrefix('home'), this.cache.delByPrefix('categories'), this.cache.delByPrefix('product')]);
  }

  async overview() {
    const today = new Date(new Date().setHours(0, 0, 0, 0));
    const since = new Date(today.getTime() - 6 * DAY);
    const [users, sellers, ordersToday, gmvToday, week, pendingShops, pendingProducts, openReturns, expiring] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.shop.count({ where: { status: 'APPROVED' } }),
      this.prisma.order.count({ where: { createdAt: { gte: today }, status: VALID } }),
      this.prisma.order.aggregate({ where: { createdAt: { gte: today }, status: VALID }, _sum: { total: true } }),
      this.prisma.order.findMany({ where: { createdAt: { gte: since }, status: VALID }, select: { total: true, createdAt: true } }),
      this.prisma.shop.count({ where: { status: 'PENDING' } }),
      this.prisma.product.count({ where: { status: 'PENDING' } }),
      this.prisma.returnRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.banner.count({ where: { active: true, endsAt: { lte: new Date(Date.now() + 3 * DAY) } } }),
    ]);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(since.getTime() + i * DAY);
      return { label: `${d.getDate()}/${d.getMonth() + 1}`, gmv: week.filter((o) => o.createdAt.toDateString() === d.toDateString()).reduce((a, o) => a + o.total, 0) };
    });
    return { users, sellers, ordersToday, gmvToday: gmvToday._sum.total ?? 0, days, todos: { pendingShops, pendingProducts, openReturns, expiring } };
  }

  // ---------- Người bán ----------
  shops(status?: string) {
    return this.prisma.shop.findMany({
      where: status && status in ApprovalStatus ? { status: status as ApprovalStatus } : {},
      orderBy: { createdAt: 'desc' },
      include: { owner: { select: { name: true, email: true, phone: true } }, _count: { select: { products: true, orders: true } } },
    });
  }

  async reviewShop(id: number, approve: boolean) {
    const shop = await this.prisma.shop.update({ where: { id }, data: { status: approve ? 'APPROVED' : 'REJECTED' } });
    if (approve) await this.prisma.user.update({ where: { id: shop.ownerId }, data: { role: 'SELLER' } });
    await this.orders.notify(
      shop.ownerId,
      approve ? 'Cửa hàng đã được duyệt' : 'Hồ sơ người bán bị từ chối',
      approve ? `${shop.name} đã có thể bắt đầu bán hàng trên Giá Tốt.` : 'Vui lòng kiểm tra lại giấy tờ và gửi lại hồ sơ.',
      'SYSTEM',
    );
    await this.bust();
    return shop;
  }

  async setMall(id: number, isMall: boolean) {
    const s = await this.prisma.shop.update({ where: { id }, data: { isMall } });
    await this.bust();
    return s;
  }

  // ---------- Người dùng ----------
  users(q?: string) {
    const where: Prisma.UserWhereInput = q
      ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }, { email: { contains: q, mode: 'insensitive' } }] }
      : {};
    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, name: true, email: true, phone: true, role: true, status: true, createdAt: true, _count: { select: { orders: true } } },
    });
  }

  async toggleLock(id: number) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (u.role === 'ADMIN') throw new BadRequestException('Không thể khóa tài khoản quản trị');
    return this.prisma.user.update({ where: { id }, data: { status: u.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE' }, select: { id: true, status: true } });
  }

  // ---------- Danh mục & thương hiệu ----------
  categories() {
    return this.prisma.category.findMany({
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }],
      include: { brands: { orderBy: { id: 'asc' } }, _count: { select: { products: true } } },
    });
  }

  async createCategory(dto: CategoryDto) {
    const count = await this.prisma.category.count();
    const c = await this.prisma.category.create({ data: { name: dto.name, parentId: dto.parentId, slug: `${slugify(dto.name)}-${Date.now().toString(36)}`, sortOrder: count } });
    await this.bust();
    return c;
  }

  async updateCategory(id: number, dto: CategoryPatchDto) {
    const c = await this.prisma.category.update({ where: { id }, data: dto });
    await this.bust();
    return c;
  }

  async addBrand(categoryId: number, name: string) {
    if (!name?.trim()) throw new BadRequestException('Nhập tên thương hiệu');
    const b = await this.prisma.brand.create({ data: { categoryId, name: name.trim() } });
    await this.bust();
    return b;
  }

  async deleteBrand(id: number) {
    await this.prisma.brand.delete({ where: { id } });
    await this.bust();
    return { ok: true };
  }

  // ---------- Duyệt sản phẩm ----------
  products(status?: string, q?: string) {
    return this.prisma.product.findMany({
      where: {
        ...(status && status in ApprovalStatus ? { status: status as ApprovalStatus } : {}),
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { shop: { select: { name: true } }, category: { select: { name: true } } },
    });
  }

  async reviewProduct(id: number, approve: boolean, reason?: string) {
    const p = await this.prisma.product.update({
      where: { id },
      data: { status: approve ? 'APPROVED' : 'REJECTED', flag: approve ? null : reason || 'Vi phạm chính sách đăng bán' },
      include: { shop: true },
    });
    await this.orders.notify(
      p.shop.ownerId,
      approve ? 'Sản phẩm đã được duyệt' : 'Sản phẩm bị gỡ',
      approve ? `"${p.name}" đã hiển thị trên Giá Tốt.` : `"${p.name}": ${p.flag}`,
      'SYSTEM',
    );
    await this.bust();
    return p;
  }

  // ---------- Voucher sàn ----------
  vouchers() {
    return this.prisma.voucher.findMany({ where: { scope: 'PLATFORM' }, orderBy: { createdAt: 'desc' } });
  }

  createVoucher(dto: VoucherDto) {
    return this.prisma.voucher.create({
      data: {
        code: (dto.code?.trim() || makeCode('GT')).toUpperCase(),
        name: dto.name,
        scope: 'PLATFORM',
        kind: dto.kind === 'SHIPPING' ? 'SHIPPING' : 'DISCOUNT',
        discount: dto.discount,
        minOrder: dto.minOrder ?? 0,
        quantity: dto.quantity ?? 1000,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async toggleVoucher(id: number) {
    const v = await this.prisma.voucher.findUniqueOrThrow({ where: { id } });
    return this.prisma.voucher.update({ where: { id }, data: { active: !v.active } });
  }

  // ---------- Khiếu nại ----------
  returns(status?: string) {
    return this.prisma.returnRequest.findMany({
      where: status && status in ReturnStatus ? { status: status as ReturnStatus } : {},
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } }, order: { include: { shop: { select: { name: true } }, items: { select: { name: true, qty: true } } } } },
    });
  }

  async resolve(id: number, refund: boolean) {
    await resolveReturn(this.prisma, this.orders, id, refund);
    return { ok: true };
  }

  // ---------- Banner ----------
  banners() {
    return this.prisma.banner.findMany({ orderBy: { position: 'asc' } });
  }

  async createBanner(dto: BannerDto) {
    const count = await this.prisma.banner.count();
    const b = await this.prisma.banner.create({
      data: { ...dto, position: count, startsAt: dto.startsAt ? new Date(dto.startsAt) : null, endsAt: dto.endsAt ? new Date(dto.endsAt) : null },
    });
    await this.bust();
    return b;
  }

  async updateBanner(id: number, dto: Partial<BannerDto> & { active?: boolean }) {
    const b = await this.prisma.banner.update({
      where: { id },
      data: { ...dto, startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined, endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined },
    });
    await this.bust();
    return b;
  }

  async moveBanner(id: number, dir: number) {
    const list = await this.banners();
    const i = list.findIndex((b) => b.id === id);
    const j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= list.length) return list;
    [list[i], list[j]] = [list[j], list[i]];
    await this.prisma.$transaction(list.map((b, k) => this.prisma.banner.update({ where: { id: b.id }, data: { position: k } })));
    await this.bust();
    return this.banners();
  }

  async deleteBanner(id: number) {
    await this.prisma.banner.delete({ where: { id } });
    await this.bust();
    return { ok: true };
  }

  // ---------- Báo cáo ----------
  async report(rangeDays: number) {
    const since = new Date(Date.now() - rangeDays * DAY);
    const prevSince = new Date(Date.now() - 2 * rangeDays * DAY);
    const [cur, prev, items, shops] = await Promise.all([
      this.prisma.order.aggregate({ where: { createdAt: { gte: since }, status: VALID }, _sum: { total: true, subtotal: true }, _count: true }),
      this.prisma.order.aggregate({ where: { createdAt: { gte: prevSince, lt: since }, status: VALID }, _sum: { total: true }, _count: true }),
      this.prisma.orderItem.findMany({
        where: { order: { createdAt: { gte: since }, status: VALID } },
        select: { price: true, qty: true, product: { select: { category: { select: { name: true, parent: { select: { name: true } } } } } } },
      }),
      this.prisma.order.groupBy({ by: ['shopId'], where: { createdAt: { gte: since }, status: VALID }, _sum: { total: true }, orderBy: { _sum: { total: 'desc' } }, take: 5 }),
    ]);
    const byCat = new Map<string, number>();
    for (const i of items) {
      const name = i.product.category.parent?.name ?? i.product.category.name;
      byCat.set(name, (byCat.get(name) ?? 0) + i.price * i.qty);
    }
    const shopNames = await this.prisma.shop.findMany({ where: { id: { in: shops.map((s) => s.shopId) } }, select: { id: true, name: true } });
    const gmv = cur._sum.total ?? 0;
    const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);
    return {
      gmv, gmvChange: pct(gmv, prev._sum.total ?? 0),
      orders: cur._count, ordersChange: pct(cur._count, prev._count),
      platformFee: Math.round((cur._sum.subtotal ?? 0) * PLATFORM_FEE_RATE),
      avgOrder: cur._count ? Math.round(gmv / cur._count) : 0,
      byCategory: [...byCat.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      topShops: shops.map((s) => ({ name: shopNames.find((n) => n.id === s.shopId)?.name ?? `#${s.shopId}`, value: s._sum.total ?? 0 })),
    };
  }

  async exportCsv(rangeDays: number) {
    const since = new Date(Date.now() - rangeDays * DAY);
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      include: { shop: { select: { name: true } }, buyer: { select: { name: true } } },
    });
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Mã đơn', 'Ngày', 'Người mua', 'Cửa hàng', 'Trạng thái', 'Thanh toán', 'Tiền hàng', 'Phí ship', 'Giảm giá', 'Tổng'];
    const rows = orders.map((o) =>
      [o.code, o.createdAt.toISOString(), o.buyer.name, o.shop.name, o.status, o.paymentMethod, o.subtotal, o.shippingFee, o.discount, o.total].map(esc).join(','),
    );
    return '﻿' + [header.map(esc).join(','), ...rows].join('\n');
  }
}

@Controller('admin')
@Roles('ADMIN')
export class AdminController {
  constructor(private s: AdminService) {}

  @Get('overview') overview() { return this.s.overview(); }

  @Get('shops') shops(@Query('status') status?: string) { return this.s.shops(status); }
  @Post('shops/:id/approve') approveShop(@Param('id', ParseIntPipe) id: number) { return this.s.reviewShop(id, true); }
  @Post('shops/:id/reject') rejectShop(@Param('id', ParseIntPipe) id: number) { return this.s.reviewShop(id, false); }
  @Post('shops/:id/mall') mall(@Param('id', ParseIntPipe) id: number, @Body('isMall') isMall: boolean) { return this.s.setMall(id, !!isMall); }

  @Get('users') users(@Query('q') q?: string) { return this.s.users(q); }
  @Post('users/:id/toggle-lock') lock(@Param('id', ParseIntPipe) id: number) { return this.s.toggleLock(id); }

  @Get('categories') categories() { return this.s.categories(); }
  @Post('categories') createCategory(@Body() dto: CategoryDto) { return this.s.createCategory(dto); }
  @Patch('categories/:id') updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: CategoryPatchDto) { return this.s.updateCategory(id, dto); }
  @Post('categories/:id/brands') addBrand(@Param('id', ParseIntPipe) id: number, @Body('name') name: string) { return this.s.addBrand(id, name); }
  @Delete('brands/:id') deleteBrand(@Param('id', ParseIntPipe) id: number) { return this.s.deleteBrand(id); }

  @Get('products') products(@Query('status') status?: string, @Query('q') q?: string) { return this.s.products(status, q); }
  @Post('products/:id/approve') approveProduct(@Param('id', ParseIntPipe) id: number) { return this.s.reviewProduct(id, true); }
  @Post('products/:id/reject') rejectProduct(@Param('id', ParseIntPipe) id: number, @Body('reason') reason?: string) { return this.s.reviewProduct(id, false, reason); }

  @Get('vouchers') vouchers() { return this.s.vouchers(); }
  @Post('vouchers') createVoucher(@Body() dto: VoucherDto) { return this.s.createVoucher(dto); }
  @Post('vouchers/:id/toggle') toggleVoucher(@Param('id', ParseIntPipe) id: number) { return this.s.toggleVoucher(id); }

  @Get('returns') returns(@Query('status') status?: string) { return this.s.returns(status); }
  @Post('returns/:id/refund') refund(@Param('id', ParseIntPipe) id: number) { return this.s.resolve(id, true); }
  @Post('returns/:id/reject') reject(@Param('id', ParseIntPipe) id: number) { return this.s.resolve(id, false); }

  @Get('banners') banners() { return this.s.banners(); }
  @Post('banners') createBanner(@Body() dto: BannerDto) { return this.s.createBanner(dto); }
  @Patch('banners/:id') updateBanner(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<BannerDto> & { active?: boolean }) { return this.s.updateBanner(id, dto); }
  @Post('banners/:id/move') moveBanner(@Param('id', ParseIntPipe) id: number, @Body('dir') dir: number) { return this.s.moveBanner(id, Number(dir)); }
  @Delete('banners/:id') deleteBanner(@Param('id', ParseIntPipe) id: number) { return this.s.deleteBanner(id); }

  @Get('reports') report(@Query('range') range?: string) { return this.s.report(Math.max(1, toInt(range, 7))); }
  @Get('reports/export.csv') @Header('Content-Type', 'text/csv; charset=utf-8') @Header('Content-Disposition', 'attachment; filename="bao-cao-giatot.csv"')
  exportCsv(@Query('range') range?: string) { return this.s.exportCsv(Math.max(1, toInt(range, 7))); }
}

@Module({ imports: [OrdersModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}

