import {
  BadRequestException, Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, ParseIntPipe, Patch, Post, Put,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/auth';
import { CARD_SELECT, LIVE_PRODUCT } from '../catalog/catalog.module';
import { PrismaService } from '../prisma/prisma.service';

class AddCartDto {
  @IsInt() productId!: number;
  @IsOptional() @IsInt() @Min(1) qty?: number;
  @IsOptional() @IsString() variant?: string;
}

class UpdateCartDto {
  @IsOptional() @IsInt() @Min(1) qty?: number;
  @IsOptional() @IsBoolean() selected?: boolean;
}

class AddressDto {
  @IsString() @MinLength(2) fullName!: string;
  @IsString() @MinLength(8) phone!: string;
  @IsString() @MinLength(3) line!: string;
  @IsInt() provinceId!: number;
  @IsString() provinceName!: string;
  @IsInt() districtId!: number;
  @IsString() districtName!: string;
  @IsString() wardCode!: string;
  @IsString() wardName!: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

const CHECKIN_XU = [10, 10, 15, 20, 20, 30, 50];

@Injectable()
export class AccountService {
  constructor(private prisma: PrismaService) {}

  // ---------- Giỏ hàng ----------
  cart(userId: number) {
    return this.prisma.cartItem.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      include: { product: { select: { ...CARD_SELECT, weight: true, visible: true, status: true } } },
    });
  }

  async addCart(userId: number, dto: AddCartDto) {
    const product = await this.prisma.product.findFirst({ where: { id: dto.productId, ...LIVE_PRODUCT } });
    if (!product) throw new NotFoundException('Sản phẩm không còn bán');
    if (product.stock < 1) throw new BadRequestException('Sản phẩm đã hết hàng');
    const variant = dto.variant ?? '';
    const qty = dto.qty ?? 1;
    return this.prisma.cartItem.upsert({
      where: { userId_productId_variant: { userId, productId: dto.productId, variant } },
      update: { qty: { increment: qty }, selected: true },
      create: { userId, productId: dto.productId, qty, variant },
    });
  }

  async updateCart(userId: number, id: number, dto: UpdateCartDto) {
    await this.prisma.cartItem.findFirstOrThrow({ where: { id, userId } });
    return this.prisma.cartItem.update({ where: { id }, data: dto });
  }

  async removeCart(userId: number, id: number) {
    await this.prisma.cartItem.deleteMany({ where: { id, userId } });
    return { ok: true };
  }

  async selectAll(userId: number, selected: boolean) {
    await this.prisma.cartItem.updateMany({ where: { userId }, data: { selected } });
    return { ok: true };
  }

  // ---------- Địa chỉ ----------
  addresses(userId: number) {
    return this.prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] });
  }

  async saveAddress(userId: number, dto: AddressDto, id?: number) {
    const count = await this.prisma.address.count({ where: { userId } });
    const isDefault = dto.isDefault || count === 0;
    if (isDefault) await this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    if (id) {
      await this.prisma.address.findFirstOrThrow({ where: { id, userId } });
      return this.prisma.address.update({ where: { id }, data: { ...dto, isDefault: isDefault || undefined } });
    }
    return this.prisma.address.create({ data: { ...dto, userId, isDefault } });
  }

  async setDefaultAddress(userId: number, id: number) {
    await this.prisma.address.findFirstOrThrow({ where: { id, userId } });
    await this.prisma.$transaction([
      this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
      this.prisma.address.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return { ok: true };
  }

  async removeAddress(userId: number, id: number) {
    await this.prisma.address.deleteMany({ where: { id, userId } });
    return { ok: true };
  }

  // ---------- Yêu thích ----------
  async wishlist(userId: number) {
    const rows = await this.prisma.wishlist.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { product: { select: CARD_SELECT } } });
    return rows.map((r) => r.product);
  }

  async toggleWish(userId: number, productId: number) {
    const key = { userId_productId: { userId, productId } };
    const existing = await this.prisma.wishlist.findUnique({ where: key });
    if (existing) {
      await this.prisma.wishlist.delete({ where: key });
      return { liked: false };
    }
    await this.prisma.wishlist.create({ data: { userId, productId } });
    return { liked: true };
  }

  // ---------- Voucher & Xu ----------
  async vouchers(userId: number) {
    const [list, saved, user] = await Promise.all([
      this.prisma.voucher.findMany({
        where: { active: true, OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
        orderBy: [{ scope: 'asc' }, { discount: 'desc' }],
        include: { shop: { select: { id: true, name: true } } },
      }),
      this.prisma.userVoucher.findMany({ where: { userId } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { xu: true, checkInDays: true, lastCheckIn: true } }),
    ]);
    const savedMap = new Map(saved.map((s) => [s.voucherId, s]));
    const today = new Date().toDateString();
    return {
      xu: user.xu,
      checkIn: { days: user.checkInDays % 7, doneToday: user.lastCheckIn?.toDateString() === today, rewards: CHECKIN_XU },
      vouchers: list.map((v) => ({ ...v, saved: savedMap.has(v.id), usedByMe: !!savedMap.get(v.id)?.usedAt, soldOut: v.used >= v.quantity })),
    };
  }

  async saveVoucher(userId: number, voucherId: number) {
    const v = await this.prisma.voucher.findFirst({ where: { id: voucherId, active: true } });
    if (!v) throw new NotFoundException('Voucher không tồn tại');
    await this.prisma.userVoucher.upsert({ where: { userId_voucherId: { userId, voucherId } }, update: {}, create: { userId, voucherId } });
    return { ok: true };
  }

  async checkIn(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const now = new Date();
    if (user.lastCheckIn?.toDateString() === now.toDateString()) throw new BadRequestException('Hôm nay bạn đã điểm danh');
    const yesterday = new Date(now.getTime() - 86400_000).toDateString();
    const streak = user.lastCheckIn?.toDateString() === yesterday ? user.checkInDays : 0;
    const reward = CHECKIN_XU[streak % 7];
    await this.prisma.user.update({ where: { id: userId }, data: { xu: { increment: reward }, checkInDays: streak + 1, lastCheckIn: now } });
    return { reward };
  }

  // ---------- Thông báo ----------
  notifications(userId: number) {
    return this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async readNotification(userId: number, id?: number) {
    await this.prisma.notification.updateMany({ where: { userId, ...(id ? { id } : {}) }, data: { read: true } });
    return { ok: true };
  }
}

@Controller()
export class AccountController {
  constructor(private s: AccountService) {}

  @Get('cart') cart(@CurrentUser() u: AuthUser) { return this.s.cart(u.id); }
  @Post('cart') addCart(@CurrentUser() u: AuthUser, @Body() dto: AddCartDto) { return this.s.addCart(u.id, dto); }
  @Patch('cart/:id') updateCart(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCartDto) { return this.s.updateCart(u.id, id, dto); }
  @Delete('cart/:id') removeCart(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.s.removeCart(u.id, id); }
  @Post('cart/select-all') selectAll(@CurrentUser() u: AuthUser, @Body('selected') selected: boolean) { return this.s.selectAll(u.id, !!selected); }

  @Get('addresses') addresses(@CurrentUser() u: AuthUser) { return this.s.addresses(u.id); }
  @Post('addresses') addAddress(@CurrentUser() u: AuthUser, @Body() dto: AddressDto) { return this.s.saveAddress(u.id, dto); }
  @Put('addresses/:id') editAddress(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: AddressDto) { return this.s.saveAddress(u.id, dto, id); }
  @Post('addresses/:id/default') defaultAddress(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.s.setDefaultAddress(u.id, id); }
  @Delete('addresses/:id') removeAddress(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.s.removeAddress(u.id, id); }

  @Get('wishlist') wishlist(@CurrentUser() u: AuthUser) { return this.s.wishlist(u.id); }
  @Post('wishlist/:productId') toggleWish(@CurrentUser() u: AuthUser, @Param('productId', ParseIntPipe) id: number) { return this.s.toggleWish(u.id, id); }

  @Get('vouchers') vouchers(@CurrentUser() u: AuthUser) { return this.s.vouchers(u.id); }
  @Post('vouchers/:id/save') saveVoucher(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.s.saveVoucher(u.id, id); }
  @Post('check-in') checkIn(@CurrentUser() u: AuthUser) { return this.s.checkIn(u.id); }

  @Get('notifications') notifications(@CurrentUser() u: AuthUser) { return this.s.notifications(u.id); }
  @Post('notifications/read-all') readAll(@CurrentUser() u: AuthUser) { return this.s.readNotification(u.id); }
  @Post('notifications/:id/read') read(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.s.readNotification(u.id, id); }
}

@Module({ controllers: [AccountController], providers: [AccountService] })
export class AccountModule {}
