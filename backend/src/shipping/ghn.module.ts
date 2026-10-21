import { BadRequestException, Body, Controller, Get, Injectable, Logger, Module, Post, Query } from '@nestjs/common';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { Public } from '../common/auth';
import { toInt } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';

/*
 * Tích hợp Giao Hàng Nhanh (GHN). Mặc định dùng môi trường thử nghiệm:
 *   https://dev-online-gateway.ghn.vn/shiip/public-api
 * Nếu chưa có GHN_TOKEN / GHN_SHOP_ID, service chạy ở chế độ giả lập (mock)
 * để có thể demo đầy đủ luồng đặt hàng mà không cần tài khoản GHN.
 */

type Loc = { id: number; name: string };
const MOCK_PROVINCES: Loc[] = [
  { id: 201, name: 'Hà Nội' }, { id: 202, name: 'Hồ Chí Minh' }, { id: 203, name: 'Đà Nẵng' }, { id: 220, name: 'Cần Thơ' }, { id: 255, name: 'Vĩnh Long' },
];
const MOCK_DISTRICTS: Record<number, Loc[]> = {
  201: [{ id: 1485, name: 'Quận Ba Đình' }, { id: 1489, name: 'Quận Hoàn Kiếm' }, { id: 1493, name: 'Quận Cầu Giấy' }],
  202: [{ id: 1442, name: 'Quận 1' }, { id: 1444, name: 'Quận 3' }, { id: 1452, name: 'Quận Bình Thạnh' }],
  203: [{ id: 1526, name: 'Quận Hải Châu' }, { id: 1527, name: 'Quận Thanh Khê' }],
  220: [{ id: 1572, name: 'Quận Ninh Kiều' }, { id: 1573, name: 'Quận Bình Thủy' }],
  255: [{ id: 1560, name: 'Thành phố Vĩnh Long' }, { id: 1825, name: 'Huyện Mang Thít' }],
};
const MOCK_WARDS = (districtId: number) =>
  [1, 2, 3].map((n) => ({ code: `${districtId}0${n}`, name: `Phường ${n}` }));

export interface FeeInput {
  fromDistrictId?: number | null;
  fromWardCode?: string | null;
  toDistrictId: number;
  toWardCode: string;
  weight: number;
  insuranceValue: number;
}

export interface GhnCreateInput {
  orderCode: string;
  toName: string;
  toPhone: string;
  toAddress: string;
  toWardCode: string;
  toDistrictId: number;
  codAmount: number;
  weight: number;
  insuranceValue: number;
  items: { name: string; quantity: number; price: number }[];
  fromName: string;
  fromPhone: string;
  fromAddress: string;
}

@Injectable()
export class GhnService {
  private readonly logger = new Logger('GHN');
  private readonly base = process.env.GHN_API_URL || 'https://dev-online-gateway.ghn.vn/shiip/public-api';
  private readonly token = process.env.GHN_TOKEN;
  private readonly shopId = process.env.GHN_SHOP_ID;

  constructor(private cache: CacheService) {}

  get mock() {
    return !this.token || !this.shopId;
  }

  private async call<T>(path: string, body?: unknown, method: 'GET' | 'POST' = 'POST'): Promise<T> {
    const res = await fetch(this.base + path, {
      method,
      headers: { 'Content-Type': 'application/json', Token: this.token!, ShopId: this.shopId! },
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as { code?: number; message?: string; code_message_value?: string; data?: T };
    if (!res.ok || json.code !== 200) {
      this.logger.warn(`${path} -> ${res.status} ${json.message}`);
      throw new BadRequestException(`GHN: ${json.code_message_value || json.message || 'Lỗi kết nối'}`);
    }
    return json.data as T;
  }

  provinces(): Promise<Loc[]> {
    if (this.mock) return Promise.resolve(MOCK_PROVINCES);
    return this.cache.wrap('ghn:provinces', 86400, async () => {
      const data = await this.call<{ ProvinceID: number; ProvinceName: string }[]>('/master-data/province', undefined, 'GET');
      return data.map((p) => ({ id: p.ProvinceID, name: p.ProvinceName })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    });
  }

  districts(provinceId: number): Promise<Loc[]> {
    if (this.mock) return Promise.resolve(MOCK_DISTRICTS[provinceId] ?? [{ id: provinceId * 10, name: 'Trung tâm' }]);
    return this.cache.wrap(`ghn:districts:${provinceId}`, 86400, async () => {
      const data = await this.call<{ DistrictID: number; DistrictName: string }[]>('/master-data/district', { province_id: provinceId });
      return data.map((d) => ({ id: d.DistrictID, name: d.DistrictName }));
    });
  }

  wards(districtId: number): Promise<{ code: string; name: string }[]> {
    if (this.mock) return Promise.resolve(MOCK_WARDS(districtId));
    return this.cache.wrap(`ghn:wards:${districtId}`, 86400, async () => {
      const data = await this.call<{ WardCode: string; WardName: string }[] | null>('/master-data/ward', { district_id: districtId });
      return (data ?? []).map((w) => ({ code: w.WardCode, name: w.WardName }));
    });
  }

  /** Tính phí giao hàng (dịch vụ chuẩn - service_type_id 2). */
  async fee(input: FeeInput): Promise<{ fee: number; leadDays: string }> {
    const weight = Math.max(100, input.weight);
    if (this.mock) {
      const sameRegion = input.fromDistrictId && Math.floor(input.fromDistrictId / 100) === Math.floor(input.toDistrictId / 100);
      const base = sameRegion ? 16500 : 30500;
      const extra = Math.max(0, Math.ceil((weight - 500) / 500)) * 5000;
      return { fee: base + extra, leadDays: sameRegion ? '1-2 ngày' : '3-5 ngày' };
    }
    const data = await this.call<{ total: number }>('/v2/shipping-order/fee', {
      service_type_id: 2,
      from_district_id: input.fromDistrictId ?? undefined,
      from_ward_code: input.fromWardCode ?? undefined,
      to_district_id: input.toDistrictId,
      to_ward_code: input.toWardCode,
      weight,
      length: 20, width: 15, height: 10,
      insurance_value: Math.min(input.insuranceValue, 5_000_000),
    });
    return { fee: data.total, leadDays: '2-4 ngày' };
  }

  /** Tạo vận đơn GHN khi người bán xác nhận đơn. */
  async createOrder(o: GhnCreateInput): Promise<{ orderCode: string; expectedDelivery: Date; fee: number }> {
    if (this.mock) {
      return { orderCode: 'GHNMOCK' + o.orderCode.slice(-6), expectedDelivery: new Date(Date.now() + 3 * 86400_000), fee: 0 };
    }
    const data = await this.call<{ order_code: string; expected_delivery_time: string; total_fee: number }>('/v2/shipping-order/create', {
      payment_type_id: 1, // người bán trả phí ship (đã thu của người mua)
      note: `Đơn ${o.orderCode} - Giá Tốt`,
      required_note: 'CHOXEMHANGKHONGTHU',
      client_order_code: o.orderCode,
      from_name: o.fromName,
      from_phone: o.fromPhone,
      from_address: o.fromAddress,
      to_name: o.toName,
      to_phone: o.toPhone,
      to_address: o.toAddress,
      to_ward_code: o.toWardCode,
      to_district_id: o.toDistrictId,
      cod_amount: o.codAmount,
      weight: Math.max(100, o.weight),
      length: 20, width: 15, height: 10,
      insurance_value: Math.min(o.insuranceValue, 5_000_000),
      service_type_id: 2,
      items: o.items,
    });
    return { orderCode: data.order_code, expectedDelivery: new Date(data.expected_delivery_time), fee: data.total_fee };
  }

  async tracking(orderCode: string): Promise<{ status: string; log: { status: string; updated_date: string }[] }> {
    if (this.mock || orderCode.startsWith('GHNMOCK')) return { status: 'mock', log: [] };
    const data = await this.call<{ status: string; log?: { status: string; updated_date: string }[] }>('/v2/shipping-order/detail', { order_code: orderCode });
    return { status: data.status, log: data.log ?? [] };
  }

  async cancel(orderCode: string) {
    if (this.mock || orderCode.startsWith('GHNMOCK')) return;
    await this.call('/v2/switch-status/cancel', { order_codes: [orderCode] }).catch(() => undefined);
  }
}

class FeeDto {
  @IsInt() addressId!: number;
  @IsInt() shopId!: number;
  @IsOptional() @IsInt() weight?: number;
  @IsOptional() @IsInt() value?: number;
}

@Controller('shipping')
export class ShippingController {
  constructor(private ghn: GhnService, private prisma: PrismaService) {}

  @Public() @Get('provinces') provinces() { return this.ghn.provinces(); }
  @Public() @Get('districts') districts(@Query('provinceId') id: string) { return this.ghn.districts(toInt(id, 0)); }
  @Public() @Get('wards') wards(@Query('districtId') id: string) { return this.ghn.wards(toInt(id, 0)); }
  @Public() @Get('status') status() { return { provider: 'GHN', mock: this.ghn.mock }; }

  @Post('fee')
  async fee(@Body() dto: FeeDto) {
    const [addr, shop] = await Promise.all([
      this.prisma.address.findUniqueOrThrow({ where: { id: dto.addressId } }),
      this.prisma.shop.findUniqueOrThrow({ where: { id: dto.shopId } }),
    ]);
    return this.ghn.fee({
      fromDistrictId: shop.districtId, fromWardCode: shop.wardCode,
      toDistrictId: addr.districtId, toWardCode: addr.wardCode,
      weight: dto.weight ?? 500, insuranceValue: dto.value ?? 0,
    });
  }
}

@Module({ controllers: [ShippingController], providers: [GhnService], exports: [GhnService] })
export class ShippingModule {}
