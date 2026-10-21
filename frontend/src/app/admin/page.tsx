'use client';

import Link from 'next/link';
import { PageTitle } from '@/components/DashboardShell';
import { Bars, Loading, Stat } from '@/components/ui';
import { useApi } from '@/lib/api';
import { vnd } from '@/lib/format';

interface Overview {
  users: number; sellers: number; ordersToday: number; gmvToday: number;
  days: { label: string; gmv: number }[];
  todos: { pendingShops: number; pendingProducts: number; openReturns: number; expiring: number };
}

export default function AdminOverview() {
  const { data } = useApi<Overview>('/admin/overview');
  if (!data) return <Loading />;
  const todos: [string, number, string][] = [
    ['Hồ sơ người bán chờ duyệt', data.todos.pendingShops, '/admin/sellers'],
    ['Sản phẩm chờ duyệt', data.todos.pendingProducts, '/admin/products'],
    ['Khiếu nại đang chờ', data.todos.openReturns, '/admin/returns'],
    ['Banner sắp hết hạn', data.todos.expiring, '/admin/banners'],
  ];
  return (
    <>
      <PageTitle>Tổng quan nền tảng</PageTitle>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        <Stat label="Người dùng" value={vnd(data.users)} />
        <Stat label="Người bán hoạt động" value={vnd(data.sellers)} sub={`${data.todos.pendingShops} hồ sơ chờ duyệt`} />
        <Stat label="Đơn hàng hôm nay" value={vnd(data.ordersToday)} />
        <Stat label="GMV hôm nay" value={`${vnd(data.gmvToday)}đ`} />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="card flex flex-[2_1_380px] flex-col gap-3.5 p-5">
          <b>Giá trị giao dịch 7 ngày (triệu đồng)</b>
          <Bars data={data.days.map((d) => ({ label: d.label, value: d.gmv }))} />
        </div>
        <div className="card flex flex-[1_1_260px] flex-col gap-2.5 p-5">
          <b>Cần xử lý</b>
          {todos.map(([l, n, href]) => (
            <Link key={l} href={href} className="flex justify-between rounded-md bg-canvas p-3 text-[13px] hover:bg-brand-soft"><span>{l}</span><b className="text-brand">{n}</b></Link>
          ))}
        </div>
      </div>
    </>
  );
}
