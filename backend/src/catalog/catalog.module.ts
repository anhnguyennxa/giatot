import { Controller, Get, Injectable, Module, NotFoundException, Param, ParseIntPipe, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Public } from '../common/auth';
import { toInt } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';

export const CARD_SELECT = {
  id: true, name: true, price: true, originalPrice: true, sold: true, rating: true, images: true, freeShip: true, stock: true,
  shop: { select: { id: true, name: true, city: true, isMall: true } },
  brand: { select: { id: true, name: true } },
} satisfies Prisma.ProductSelect;

/** Điều kiện để sản phẩm hiển thị cho người mua. */
export const LIVE_PRODUCT: Prisma.ProductWhereInput = {
  status: 'APPROVED',
  visible: true,
  shop: { status: 'APPROVED', vacationMode: false },
  category: { visible: true },
};

export interface ProductQuery {
  q?: string; categoryId?: string; brandId?: string; shopId?: string; minPrice?: string; maxPrice?: string;
  minRating?: string; freeShip?: string; sort?: string; page?: string; limit?: string;
}

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService, private cache: CacheService) {}

  home() {
    return this.cache.wrap('home', 60, async () => {
      const now = new Date();
      const [banners, categories, flash, malls, suggestions] = await Promise.all([
        this.prisma.banner.findMany({
          where: { active: true, OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          orderBy: { position: 'asc' },
        }),
        this.prisma.category.findMany({ where: { visible: true, parentId: null }, orderBy: { sortOrder: 'asc' } }),
        this.prisma.product.findMany({ where: { ...LIVE_PRODUCT, isFlashSale: true }, select: CARD_SELECT, take: 12, orderBy: { sold: 'desc' } }),
        this.prisma.shop.findMany({ where: { status: 'APPROVED', isMall: true }, take: 8, orderBy: { followers: 'desc' } }),
        this.prisma.product.findMany({ where: LIVE_PRODUCT, select: CARD_SELECT, take: 24, orderBy: { sold: 'desc' } }),
      ]);
      // Flash sale kết thúc lúc 24:00 hôm nay (giờ Việt Nam).
      const vn = new Date(now.getTime() + 7 * 3600_000);
      const end = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + 1) - 7 * 3600_000;
      return { banners, categories, flash, flashEndsAt: new Date(end).toISOString(), malls, suggestions };
    });
  }

  categories() {
    return this.cache.wrap('categories', 300, () =>
      this.prisma.category.findMany({
        where: { visible: true, parentId: null },
        orderBy: { sortOrder: 'asc' },
        include: { children: { where: { visible: true }, orderBy: { sortOrder: 'asc' } }, brands: { orderBy: { id: 'asc' } } },
      }),
    );
  }

  async search(q: ProductQuery) {
    const page = Math.max(1, toInt(q.page, 1));
    const limit = Math.min(60, Math.max(1, toInt(q.limit, 20)));
    const where: Prisma.ProductWhereInput = { ...LIVE_PRODUCT };
    const and: Prisma.ProductWhereInput[] = [];
    if (q.q?.trim()) and.push({ OR: [{ name: { contains: q.q.trim(), mode: 'insensitive' } }, { shop: { name: { contains: q.q.trim(), mode: 'insensitive' } } }] });
    if (q.categoryId) {
      const id = toInt(q.categoryId, 0);
      and.push({ OR: [{ categoryId: id }, { category: { parentId: id } }] });
    }
    if (q.brandId) and.push({ brandId: toInt(q.brandId, 0) });
    if (q.shopId) and.push({ shopId: toInt(q.shopId, 0) });
    if (q.minPrice || q.maxPrice) and.push({ price: { gte: q.minPrice ? toInt(q.minPrice, 0) : undefined, lte: q.maxPrice ? toInt(q.maxPrice, 0) : undefined } });
    if (q.minRating) and.push({ rating: { gte: Number(q.minRating) || 0 } });
    if (q.freeShip === 'true') and.push({ freeShip: true });
    if (and.length) where.AND = and;

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      q.sort === 'newest' ? { createdAt: 'desc' }
      : q.sort === 'bestseller' ? { sold: 'desc' }
      : q.sort === 'price_asc' ? { price: 'asc' }
      : q.sort === 'price_desc' ? { price: 'desc' }
      : { rating: 'desc' };

    const key = 'products:' + JSON.stringify({ where: q, page, limit });
    return this.cache.wrap(key, 30, async () => {
      const [items, total] = await Promise.all([
        this.prisma.product.findMany({ where, select: CARD_SELECT, orderBy: [orderBy, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
        this.prisma.product.count({ where }),
      ]);
      return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
    });
  }

  async product(id: number) {
    const p = await this.cache.wrap(`product:${id}`, 30, () =>
      this.prisma.product.findFirst({
        where: { id, ...LIVE_PRODUCT },
        include: {
          category: { select: { id: true, name: true, parent: { select: { id: true, name: true } } } },
          brand: { select: { id: true, name: true } },
          shop: { select: { id: true, name: true, city: true, isMall: true, rating: true, followers: true, logo: true, createdAt: true, _count: { select: { products: true } } } },
          reviews: { take: 10, orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, avatar: true } } } },
        },
      }),
    );
    if (!p) throw new NotFoundException('Sản phẩm không tồn tại hoặc đã ngừng bán');
    const related = await this.prisma.product.findMany({
      where: { ...LIVE_PRODUCT, categoryId: p.categoryId, id: { not: id } },
      select: CARD_SELECT,
      take: 12,
      orderBy: { sold: 'desc' },
    });
    return { ...p, related };
  }

  async shop(id: number) {
    const shop = await this.prisma.shop.findFirst({
      where: { id, status: 'APPROVED' },
      select: { id: true, name: true, description: true, logo: true, cover: true, isMall: true, rating: true, followers: true, city: true, createdAt: true, vacationMode: true, _count: { select: { products: true } } },
    });
    if (!shop) throw new NotFoundException('Cửa hàng không tồn tại');
    const vouchers = await this.prisma.voucher.findMany({ where: { shopId: id, active: true } });
    return { ...shop, vouchers };
  }
}

@Controller()
@Public()
export class CatalogController {
  constructor(private catalog: CatalogService) {}

  @Get('home') home() { return this.catalog.home(); }
  @Get('categories') categories() { return this.catalog.categories(); }
  @Get('products') search(@Query() q: ProductQuery) { return this.catalog.search(q); }
  @Get('products/:id') product(@Param('id', ParseIntPipe) id: number) { return this.catalog.product(id); }
  @Get('shops/:id') shop(@Param('id', ParseIntPipe) id: number) { return this.catalog.shop(id); }
}

@Module({ controllers: [CatalogController], providers: [CatalogService], exports: [CatalogService] })
export class CatalogModule {}
