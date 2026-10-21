'use client';

import Link from 'next/link';
import { PageTitle } from '@/components/DashboardShell';
import { Bars, Loading, Stat } from '@/components/ui';
import { useApi } from '@/lib/api';
import { vnd } from '@/lib/format';

interface Overview {
  shop: { name: string; balance: number };
  revenueToday: number;
  revenue7d: number;
  ordersTotal: number;
  products: number;
  days: { label: string; revenue: number }[];
  todos: { pending: number; confirmed: number; outOfStock: number; returns: number };
}

export default function SellerOverview() {
  const { data } = useApi<Overview>('/seller/overview');
  if (!data) return <Loading />;
  const todos: [string, number, string][] = [
    ['Chờ xác nhận', data.todos.pending, '/seller/orders?status=PENDING'],
    ['Chờ lấy hàng', data.todos.confirmed, '/seller/orders?status=CONFIRMED'],
    ['Sản phẩm hết hàng', data.todos.outOfStock, '/seller/products'],
    ['Yêu cầu trả hàng', data.todos.returns, '/seller/orders'],
  ];
  return (
    <>
      <PageTitle>Tổng quan</PageTitle>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        <Stat label="Doanh thu hôm nay" value={`${vnd(data.revenueToday)}đ`} />
        <Stat label="Doanh thu 7 ngày" value={`${vnd(data.revenue7d)}đ`} />
        <Stat label="Tổng đơn hàng" value={data.ordersTotal} />
        <Stat label="Số dư ví shop" value={`${vnd(data.shop.balance)}đ`} sub={<Link href="/seller/finance">Rút tiền ›</Link>} />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="card flex flex-[2_1_380px] flex-col gap-3.5 p-5">
          <b>Doanh thu 7 ngày (triệu đồng)</b>
          <Bars data={data.days.map((d) => ({ label: d.label, value: d.revenue }))} />
        </div>
        <div className="card flex flex-[1_1_240px] flex-col gap-2.5 p-5">
          <b>Cần xử lý</b>
          {todos.map(([l, n, href]) => (
            <Link key={l} href={href} className="flex justify-between rounded-md bg-canvas px-3 py-3 text-[13px] hover:bg-brand-soft">
              <span>{l}</span><b className="text-brand">{n}</b>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
