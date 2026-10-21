import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Logger, Module, NotFoundException, Param, ParseIntPipe, Post, Query, Req,
} from '@nestjs/common';
import { OrderStatus, PaymentMethod, Prisma, Voucher } from '@prisma/client';
import type { Request } from 'express';
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, Public } from '../common/auth';
import { LIVE_PRODUCT } from '../catalog/catalog.module';
import { makeCode, PLATFORM_FEE_RATE } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { GhnService, ShippingModule } from '../shipping/ghn.module';
import { VnpayService } from './vnpay.service';

class QuoteDto {
  @IsInt() addressId!: number;
  @IsOptional() @IsString() voucherCode?: string;
}

class CheckoutDto extends QuoteDto {
  @IsEnum(PaymentMethod) paymentMethod!: PaymentMethod;
  @IsOptional() @IsString() note?: string;
}

class ReviewDto {
  @IsInt() orderItemId!: number;
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) tags?: string[];
}

class ReturnDto {
  @IsString() @MinLength(3) reason!: string;
  @IsOptional() @IsString() description?: string;
}

const ORDER_INCLUDE = {
  items: true,
  shop: { select: { id: true, name: true, isMall: true } },
  returnRequest: true,
} satisfies Prisma.OrderInclude;

export interface QuoteGroup {
  shop: { id: number; name: string };
  items: { cartItemId: number; productId: number; name: string; image: string | null; price: number; qty: number; variant: string }[];
  subtotal: number;
  weight: number;
  shippingFee: number;
  leadDays: string;
  discount: number;
  shopDiscount: number;
  total: number;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger('Orders');
  constructor(
    private prisma: PrismaService,
    private ghn: GhnService,
    private vnpay: VnpayService,
    private cache: CacheService,
  ) {}

  async notify(userId: number, title: string, body: string, type: 'ORDER' | 'PROMO' | 'SYSTEM' = 'ORDER') {
    await this.prisma.notification.create({ data: { userId, title, body, type } }).catch(() => undefined);
  }

  async invalidateCatalog() {
    await Promise.all([this.cache.delByPrefix('product'), this.cache.delByPrefix('home')]);
  }

  // ---------------- Báo giá / Đặt hàng ----------------
  async quote(userId: number, dto: QuoteDto) {
    const address = await this.prisma.address.findFirst({ where: { id: dto.addressId, userId } });
    if (!address) throw new BadRequestException('Vui lòng chọn địa chỉ nhận hàng');

    const cart = await this.prisma.cartItem.findMany({
      where: { userId, selected: true },
      include: { product: { include: { shop: true } } },
      orderBy: { id: 'asc' },
    });
    if (!cart.length) throw new BadRequestException('Chưa chọn sản phẩm nào để mua');

    const liveIds = new Set(
      (await this.prisma.product.findMany({ where: { id: { in: cart.map((c) => c.productId) }, ...LIVE_PRODUCT }, select: { id: true } })).map((p) => p.id),
    );

    const groups = new Map<number, QuoteGroup>();
    for (const c of cart) {
      const p = c.product;
      if (!liveIds.has(p.id)) throw new BadRequestException(`"${p.name}" đã ngừng bán, vui lòng xóa khỏi giỏ`);
      if (c.qty > p.stock) throw new BadRequestException(`"${p.name}" chỉ còn ${p.stock} sản phẩm`);
      const g = groups.get(p.shopId) ?? {
        shop: { id: p.shop.id, name: p.shop.name }, items: [], subtotal: 0, weight: 0, shippingFee: 0, leadDays: '', discount: 0, shopDiscount: 0, total: 0,
      };
      g.items.push({ cartItemId: c.id, productId: p.id, name: p.name, image: p.images[0] ?? null, price: p.price, qty: c.qty, variant: c.variant });
      g.subtotal += p.price * c.qty;
      g.weight += p.weight * c.qty;
      groups.set(p.shopId, g);
    }

    const list = [...groups.values()];
    for (const g of list) {
      const shop = cart.find((c) => c.product.shopId === g.shop.id)!.product.shop;
      const fee = await this.ghn.fee({
        fromDistrictId: shop.districtId, fromWardCode: shop.wardCode,
        toDistrictId: address.districtId, toWardCode: address.wardCode,
        weight: g.weight, insuranceValue: g.subtotal,
      });
      g.shippingFee = fee.fee;
      g.leadDays = fee.leadDays;
      const allFree = cart.filter((c) => c.product.shopId === g.shop.id).every((c) => c.product.freeShip);
      if (allFree && g.subtotal >= 150000) g.shippingFee = 0;
    }

    let voucher: Voucher | null = null;
    if (dto.voucherCode?.trim()) {
      voucher = await this.findUsableVoucher(userId, dto.voucherCode.trim());
      this.applyVoucher(voucher, list);
    }
    for (const g of list) g.total = Math.max(0, g.subtotal + g.shippingFee - g.discount);

    const sum = (k: 'subtotal' | 'shippingFee' | 'discount' | 'total') => list.reduce((a, g) => a + g[k], 0);
    return {
      address,
      groups: list,
      voucher: voucher ? { code: voucher.code, name: voucher.name } : null,
      subtotal: sum('subtotal'),
      shippingFee: sum('shippingFee'),
      discount: sum('discount'),
      total: sum('total'),
      ghnMock: this.ghn.mock,
      vnpayReady: this.vnpay.configured,
    };
  }

  private async findUsableVoucher(userId: number, code: string) {
    const v = await this.prisma.voucher.findUnique({ where: { code } });
    if (!v || !v.active || (v.expiresAt && v.expiresAt < new Date())) throw new BadRequestException('Voucher không hợp lệ hoặc đã hết hạn');
    if (v.used >= v.quantity) throw new BadRequestException('Voucher đã hết lượt sử dụng');
    const mine = await this.prisma.userVoucher.findUnique({ where: { userId_voucherId: { userId, voucherId: v.id } } });
    if (mine?.usedAt) throw new BadRequestException('Bạn đã sử dụng voucher này');
    return v;
  }

  private applyVoucher(v: Voucher, groups: QuoteGroup[]) {
    const targets = v.scope === 'SHOP' ? groups.filter((g) => g.shop.id === v.shopId) : groups;
    if (!targets.length) throw new BadRequestException('Voucher không áp dụng cho sản phẩm đã chọn');
    const base = targets.reduce((a, g) => a + g.subtotal, 0);
    if (base < v.minOrder) throw new BadRequestException(`Đơn hàng cần tối thiểu ${v.minOrder.toLocaleString('vi-VN')}đ để dùng voucher`);

    let remaining = v.kind === 'SHIPPING'
      ? Math.min(v.discount, targets.reduce((a, g) => a + g.shippingFee, 0))
      : Math.min(v.discount, base);
    targets.forEach((g, i) => {
      const share = v.kind === 'SHIPPING'
        ? Math.min(g.shippingFee, remaining)
        : i === targets.length - 1 ? remaining : Math.min(remaining, Math.round((v.discount * g.subtotal) / base));
      g.discount += share;
      if (v.scope === 'SHOP') g.shopDiscount += share;
      remaining -= share;
    });
  }

  async checkout(userId: number, dto: CheckoutDto, ip: string) {
    const q = await this.quote(userId, dto);
    const a = q.address;
    const fullAddress = `${a.line}, ${a.wardName}, ${a.districtName}, ${a.provinceName}`;
    const isVnpay = dto.paymentMethod === 'VNPAY';

    const result = await this.prisma.$transaction(async (tx) => {
      const orders = [];
      for (const g of q.groups) {
        for (const it of g.items) {
          const upd = await tx.product.updateMany({ where: { id: it.productId, stock: { gte: it.qty } }, data: { stock: { decrement: it.qty } } });
          if (upd.count === 0) throw new BadRequestException(`"${it.name}" không đủ hàng`);
        }
        orders.push(
          await tx.order.create({
            data: {
              code: makeCode('GT'),
              buyerId: userId,
              shopId: g.shop.id,
              status: isVnpay ? 'PENDING_PAYMENT' : 'PENDING',
              paymentMethod: dto.paymentMethod,
              subtotal: g.subtotal,
              shippingFee: g.shippingFee,
              discount: g.discount,
              shopDiscount: g.shopDiscount,
              total: g.total,
              voucherCode: g.discount ? q.voucher?.code : null,
              shipName: a.fullName,
              shipPhone: a.phone,
              shipAddress: fullAddress,
              toDistrictId: a.districtId,
              toWardCode: a.wardCode,
              shippingService: `GHN Tiêu chuẩn (${g.leadDays})`,
              note: dto.note,
              items: { create: g.items.map((i) => ({ productId: i.productId, name: i.name, image: i.image, price: i.price, qty: i.qty, variant: i.variant })) },
            },
          }),
        );
      }
      await tx.cartItem.deleteMany({ where: { id: { in: q.groups.flatMap((g) => g.items.map((i) => i.cartItemId)) } } });
      if (q.voucher) {
        const v = await tx.voucher.update({ where: { code: q.voucher.code }, data: { used: { increment: 1 } } });
        await tx.userVoucher.upsert({
          where: { userId_voucherId: { userId, voucherId: v.id } },
          update: { usedAt: new Date() },
          create: { userId, voucherId: v.id, usedAt: new Date() },
        });
      }
      let payment = null;
      if (isVnpay) {
        payment = await tx.payment.create({
          data: { txnRef: makeCode('PAY') + Date.now().toString().slice(-4), userId, amount: q.total, orders: { connect: orders.map((o) => ({ id: o.id })) } },
        });
      }
      return { orders, payment };
    });

    await this.invalidateCatalog();
    const codes = result.orders.map((o) => o.code).join(', ');
    await this.notify(userId, 'Đặt hàng thành công', isVnpay ? `Đơn ${codes} đang chờ thanh toán VNPay.` : `Đơn ${codes} đang chờ người bán xác nhận.`);
    for (const o of result.orders) {
      const shop = await this.prisma.shop.findUnique({ where: { id: o.shopId } });
      if (shop && !isVnpay) await this.notify(shop.ownerId, 'Có đơn hàng mới', `Đơn ${o.code} trị giá ${o.total.toLocaleString('vi-VN')}đ cần xác nhận.`);
    }

    return {
      orders: result.orders.map((o) => ({ id: o.id, code: o.code, total: o.total })),
      paymentUrl: result.payment
        ? this.vnpay.createPaymentUrl({ txnRef: result.payment.txnRef, amount: result.payment.amount, orderInfo: `Thanh toan don hang ${codes}`, ipAddr: ip })
        : null,
    };
  }

  /** Thanh toán lại một đơn đang chờ thanh toán. */
  async repay(userId: number, orderId: number, ip: string) {
    const o = await this.prisma.order.findFirst({ where: { id: orderId, buyerId: userId } });
    if (!o || o.status !== 'PENDING_PAYMENT') throw new BadRequestException('Đơn hàng không ở trạng thái chờ thanh toán');
    const payment = await this.prisma.payment.create({
      data: { txnRef: makeCode('PAY') + Date.now().toString().slice(-4), userId, amount: o.total, orders: { connect: { id: o.id } } },
    });
    return { paymentUrl: this.vnpay.createPaymentUrl({ txnRef: payment.txnRef, amount: o.total, orderInfo: `Thanh toan don hang ${o.code}`, ipAddr: ip }) };
  }

  // ---------------- VNPay callback ----------------
  async handleVnpay(query: Record<string, string>): Promise<{ RspCode: string; Message: string; orders?: string[]; success?: boolean }> {
    if (!this.vnpay.verify(query)) return { RspCode: '97', Message: 'Invalid signature' };
    const payment = await this.prisma.payment.findUnique({ where: { txnRef: query.vnp_TxnRef }, include: { orders: true } });
    if (!payment) return { RspCode: '01', Message: 'Order not found' };
    if (Number(query.vnp_Amount) !== payment.amount * 100) return { RspCode: '04', Message: 'Invalid amount' };
    const orders = payment.orders.map((o) => o.code);
    if (payment.status !== 'UNPAID') return { RspCode: '02', Message: 'Order already confirmed', orders, success: payment.status === 'PAID' };

    const success = query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00';
    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: success ? 'PAID' : 'FAILED',
          bankCode: query.vnp_BankCode,
          transactionNo: query.vnp_TransactionNo,
          responseCode: query.vnp_ResponseCode,
          payDate: query.vnp_PayDate,
        },
      }),
      ...(success
        ? [this.prisma.order.updateMany({ where: { paymentId: payment.id, status: 'PENDING_PAYMENT' }, data: { status: 'PENDING', paymentStatus: 'PAID' } })]
        : []),
    ]);
    if (success) {
      await this.notify(payment.userId, 'Thanh toán thành công', `Đã thanh toán ${payment.amount.toLocaleString('vi-VN')}đ qua VNPay cho đơn ${orders.join(', ')}.`);
      for (const o of payment.orders) {
        const shop = await this.prisma.shop.findUnique({ where: { id: o.shopId } });
        if (shop) await this.notify(shop.ownerId, 'Có đơn hàng mới', `Đơn ${o.code} đã thanh toán, cần xác nhận.`);
      }
    }
    return { RspCode: '00', Message: 'Confirm Success', orders, success };
  }

  // ---------------- Đơn của người mua ----------------
  list(userId: number, status?: string) {
    const where: Prisma.OrderWhereInput = { buyerId: userId };
    if (status && status in OrderStatus) where.status = status as OrderStatus;
    return this.prisma.order.findMany({ where, include: ORDER_INCLUDE, orderBy: { createdAt: 'desc' } });
  }

  async detail(userId: number, id: number) {
    const o = await this.prisma.order.findFirst({ where: { id, buyerId: userId }, include: ORDER_INCLUDE });
    if (!o) throw new NotFoundException('Không tìm thấy đơn hàng');
    const tracking = o.ghnOrderCode ? await this.ghn.tracking(o.ghnOrderCode).catch(() => null) : null;
    return { ...o, tracking };
  }

  async cancel(orderId: number, reason: string, by: { buyerId?: number; shopId?: number }) {
    const o = await this.prisma.order.findFirst({ where: { id: orderId, ...(by.buyerId ? { buyerId: by.buyerId } : {}), ...(by.shopId ? { shopId: by.shopId } : {}) }, include: { items: true } });
    if (!o) throw new NotFoundException('Không tìm thấy đơn hàng');
    const allowed: OrderStatus[] = by.buyerId ? ['PENDING_PAYMENT', 'PENDING'] : ['PENDING_PAYMENT', 'PENDING', 'CONFIRMED'];
    if (!allowed.includes(o.status)) throw new BadRequestException('Không thể hủy đơn ở trạng thái hiện tại');
    if (o.ghnOrderCode) await this.ghn.cancel(o.ghnOrderCode);
    await this.prisma.$transaction([
      ...o.items.map((i) => this.prisma.product.update({ where: { id: i.productId }, data: { stock: { increment: i.qty } } })),
      this.prisma.order.update({
        where: { id: o.id },
        data: { status: 'CANCELLED', cancelReason: reason, paymentStatus: o.paymentStatus === 'PAID' ? 'REFUNDED' : o.paymentStatus },
      }),
    ]);
    await this.invalidateCatalog();
    await this.notify(o.buyerId, 'Đơn hàng đã hủy', `Đơn ${o.code} đã hủy. Lý do: ${reason}.${o.paymentStatus === 'PAID' ? ' Tiền sẽ được hoàn về tài khoản thanh toán.' : ''}`);
    return { ok: true };
  }

  /** Hoàn tất đơn: cộng lượt bán và đối soát tiền về ví người bán. */
  async complete(orderId: number) {
    const o = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    if (o.status === 'COMPLETED') return o;
    const fee = Math.round(o.subtotal * PLATFORM_FEE_RATE);
    const net = o.subtotal - o.shopDiscount - fee;
    await this.prisma.$transaction([
      this.prisma.order.update({ where: { id: o.id }, data: { status: 'COMPLETED', paymentStatus: 'PAID' } }),
      ...o.items.map((i) => this.prisma.product.update({ where: { id: i.productId }, data: { sold: { increment: i.qty } } })),
      this.prisma.shop.update({ where: { id: o.shopId }, data: { balance: { increment: net } } }),
      this.prisma.shopTransaction.create({
        data: { shopId: o.shopId, type: 'SETTLEMENT', amount: net, status: 'Đã về ví', note: `Đối soát đơn ${o.code} (phí sàn ${fee.toLocaleString('vi-VN')}đ)` },
      }),
    ]);
    await this.invalidateCatalog();
    await this.notify(o.buyerId, 'Đơn hàng đã giao', `Đơn ${o.code} đã giao thành công. Đánh giá sản phẩm để nhận 200 xu!`);
    return { ok: true };
  }

  async received(userId: number, id: number) {
    const o = await this.prisma.order.findFirst({ where: { id, buyerId: userId } });
    if (!o || o.status !== 'SHIPPING') throw new BadRequestException('Đơn hàng chưa ở trạng thái đang giao');
    return this.complete(o.id);
  }

  // ---------------- Người bán xử lý đơn ----------------
  async sellerConfirm(shopId: number, id: number) {
    const o = await this.prisma.order.findFirst({ where: { id, shopId }, include: { items: { include: { product: true } }, shop: true } });
    if (!o) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (o.status !== 'PENDING') throw new BadRequestException('Chỉ xác nhận được đơn đang chờ xác nhận');
    const ghn = await this.ghn.createOrder({
      orderCode: o.code,
      toName: o.shipName, toPhone: o.shipPhone, toAddress: o.shipAddress, toWardCode: o.toWardCode, toDistrictId: o.toDistrictId,
      codAmount: o.paymentMethod === 'COD' ? o.total : 0,
      weight: o.items.reduce((a, i) => a + i.product.weight * i.qty, 0),
      insuranceValue: o.subtotal,
      items: o.items.map((i) => ({ name: i.name, quantity: i.qty, price: i.price })),
      fromName: o.shop.name, fromPhone: o.shop.pickupPhone || '0900000000', fromAddress: o.shop.pickupAddress || '',
    });
    await this.prisma.order.update({ where: { id: o.id }, data: { status: 'CONFIRMED', ghnOrderCode: ghn.orderCode, expectedDelivery: ghn.expectedDelivery } });
    await this.notify(o.buyerId, 'Người bán đã xác nhận đơn', `Đơn ${o.code} đang được chuẩn bị. Mã vận đơn GHN: ${ghn.orderCode}.`);
    return { ok: true, ghnOrderCode: ghn.orderCode };
  }

  async sellerHandover(shopId: number, id: number) {
    const o = await this.prisma.order.findFirst({ where: { id, shopId } });
    if (!o || o.status !== 'CONFIRMED') throw new BadRequestException('Đơn chưa sẵn sàng giao cho đơn vị vận chuyển');
    await this.prisma.order.update({ where: { id }, data: { status: 'SHIPPING' } });
    await this.notify(o.buyerId, 'Đơn hàng đang giao', `Đơn ${o.code} đã được giao cho GHN và đang trên đường đến bạn.`);
    return { ok: true };
  }

  async sellerDelivered(shopId: number, id: number) {
    const o = await this.prisma.order.findFirst({ where: { id, shopId } });
    if (!o || o.status !== 'SHIPPING') throw new BadRequestException('Đơn chưa ở trạng thái đang giao');
    return this.complete(id);
  }

  /** Webhook trạng thái từ GHN (cấu hình trong trang quản lý GHN). */
  async ghnWebhook(body: { OrderCode?: string; Status?: string }) {
    if (!body.OrderCode || !body.Status) return { ok: false };
    const o = await this.prisma.order.findFirst({ where: { ghnOrderCode: body.OrderCode } });
    if (!o) return { ok: false };
    const st = body.Status;
    if (['picked', 'storing', 'transporting', 'sorting', 'delivering'].includes(st) && o.status === 'CONFIRMED') {
      await this.prisma.order.update({ where: { id: o.id }, data: { status: 'SHIPPING' } });
    } else if (st === 'delivered') {
      await this.complete(o.id);
    } else if (st === 'cancel' && o.status !== 'CANCELLED') {
      await this.cancel(o.id, 'GHN hủy vận đơn', {});
    }
    return { ok: true };
  }

  // ---------------- Đánh giá & trả hàng ----------------
  async review(userId: number, dto: ReviewDto) {
    const item = await this.prisma.orderItem.findUnique({ where: { id: dto.orderItemId }, include: { order: true } });
    if (!item || item.order.buyerId !== userId) throw new NotFoundException('Không tìm thấy sản phẩm trong đơn');
    if (item.order.status !== 'COMPLETED') throw new BadRequestException('Chỉ đánh giá khi đơn đã hoàn thành');
    if (item.reviewed) throw new BadRequestException('Bạn đã đánh giá sản phẩm này');
    const product = await this.prisma.product.findUniqueOrThrow({ where: { id: item.productId } });
    const count = product.ratingCount + 1;
    const rating = Math.round(((product.rating * product.ratingCount + dto.rating) / count) * 10) / 10;
    await this.prisma.$transaction([
      this.prisma.review.create({ data: { userId, productId: item.productId, orderItemId: item.id, rating: dto.rating, content: dto.content ?? '', tags: dto.tags ?? [] } }),
      this.prisma.orderItem.update({ where: { id: item.id }, data: { reviewed: true } }),
      this.prisma.product.update({ where: { id: product.id }, data: { rating, ratingCount: count } }),
      this.prisma.user.update({ where: { id: userId }, data: { xu: { increment: 200 } } }),
    ]);
    await this.cache.delByPrefix(`product:${product.id}`);
    return { ok: true, xu: 200 };
  }

  async requestReturn(userId: number, orderId: number, dto: ReturnDto) {
    const o = await this.prisma.order.findFirst({ where: { id: orderId, buyerId: userId }, include: { returnRequest: true } });
    if (!o) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (!['SHIPPING', 'COMPLETED'].includes(o.status)) throw new BadRequestException('Chỉ yêu cầu trả hàng khi đơn đang giao hoặc đã giao');
    if (o.returnRequest) throw new BadRequestException('Đơn này đã có yêu cầu trả hàng');
    const r = await this.prisma.returnRequest.create({
      data: { code: makeCode('KN'), orderId: o.id, userId, reason: dto.reason, description: dto.description ?? '', amount: o.total },
    });
    const shop = await this.prisma.shop.findUnique({ where: { id: o.shopId } });
    if (shop) await this.notify(shop.ownerId, 'Yêu cầu trả hàng', `Người mua yêu cầu trả hàng đơn ${o.code}: ${dto.reason}.`);
    return r;
  }

  assertShop(user: AuthUser) {
    if (!user.shopId) throw new ForbiddenException('Bạn chưa có cửa hàng');
    return user.shopId;
  }
}

@Controller()
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post('checkout/quote') quote(@CurrentUser() u: AuthUser, @Body() dto: QuoteDto) { return this.orders.quote(u.id, dto); }
  @Post('checkout') checkout(@CurrentUser() u: AuthUser, @Body() dto: CheckoutDto, @Req() req: Request) { return this.orders.checkout(u.id, dto, req.ip || '127.0.0.1'); }

  @Get('orders') list(@CurrentUser() u: AuthUser, @Query('status') status?: string) { return this.orders.list(u.id, status); }
  @Get('orders/:id') detail(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.orders.detail(u.id, id); }
  @Post('orders/:id/cancel') cancel(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body('reason') reason?: string) {
    return this.orders.cancel(id, reason || 'Người mua hủy đơn', { buyerId: u.id });
  }
  @Post('orders/:id/received') received(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.orders.received(u.id, id); }
  @Post('orders/:id/pay') repay(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Req() req: Request) { return this.orders.repay(u.id, id, req.ip || '127.0.0.1'); }
  @Post('orders/:id/return') ret(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ReturnDto) { return this.orders.requestReturn(u.id, id, dto); }
  @Post('reviews') review(@CurrentUser() u: AuthUser, @Body() dto: ReviewDto) { return this.orders.review(u.id, dto); }

  /** Trình duyệt quay về từ VNPay -> frontend gọi endpoint này để xác thực và hiển thị kết quả. */
  @Public() @Get('payments/vnpay/return') vnpReturn(@Query() q: Record<string, string>) { return this.orders.handleVnpay(q); }
  /** IPN: VNPay gọi trực tiếp server-to-server (cần URL công khai, ví dụ trên Render). */
  @Public() @Get('payments/vnpay/ipn') async vnpIpn(@Query() q: Record<string, string>) {
    const r = await this.orders.handleVnpay(q);
    return { RspCode: r.RspCode, Message: r.Message };
  }
  @Public() @Post('shipping/ghn/webhook') ghnWebhook(@Body() body: { OrderCode?: string; Status?: string }) { return this.orders.ghnWebhook(body); }
}

@Module({
  imports: [ShippingModule],
  controllers: [OrdersController],
  providers: [OrdersService, VnpayService],
  exports: [OrdersService],
})
export class OrdersModule {}
