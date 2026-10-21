'use client';

import { useState } from 'react';
import { PageTitle } from '@/components/DashboardShell';
import { Loading, Meter, Stat } from '@/components/ui';
import { useApi } from '@/lib/api';
import { vnd } from '@/lib/format';

interface Analytics {
  revenue: number; revenueChange: number; orders: number; ordersChange: number; buyers: number; avgOrder: number;
  top: { productId: number; name: string; qty: number; revenue: number }[];
}

const RANGES: [number, string][] = [[1, 'Hôm nay'], [7, '7 ngày'], [30, '30 ngày']];
const change = (n: number) => `${n >= 0 ? '+' : ''}${n}% so với kỳ trước`;

export default function SellerAnalytics() {
  const [range, setRange] = useState(7);
  const { data } = useApi<Analytics>(`/seller/analytics?range=${range}`);
  const maxQty = Math.max(1, ...(data?.top.map((t) => t.qty) ?? [1]));
  return (
    <>
      <PageTitle actions={<div className="flex gap-1.5">{RANGES.map(([k, l]) => <button key={k} onClick={() => setRange(k)} className={`pill ${range === k ? 'pill-on' : 'pill-off'}`}>{l}</button>)}</div>}>
        Phân tích dữ liệu
      </PageTitle>
      {!data ? <Loading /> : (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
            <Stat label="Doanh thu" value={`${vnd(data.revenue)}đ`} sub={change(data.revenueChange)} />
            <Stat label="Đơn hàng" value={data.orders} sub={change(data.ordersChange)} />
            <Stat label="Người mua" value={data.buyers} />
            <Stat label="Giá trị đơn trung bình" value={`${vnd(data.avgOrder)}đ`} />
          </div>
          <div className="card flex flex-col gap-3.5 p-5">
            <b>Sản phẩm bán chạy</b>
            {data.top.length === 0 ? <span className="text-sm text-muted">Chưa có dữ liệu trong khoảng thời gian này</span> : data.top.map((t, i) => (
              <Meter key={t.productId} label={`${i + 1}. ${t.name}`} value={`${t.qty} sp · ${vnd(t.revenue)}đ`} pct={(t.qty / maxQty) * 100} color={i === 0 ? 'bg-brand' : 'bg-gold'} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
