'use client';

import { useState } from 'react';
import { PageTitle } from '@/components/DashboardShell';
import { Loading, Meter, Stat } from '@/components/ui';
import { API_URL, getToken, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { vnd } from '@/lib/format';

interface Report {
  gmv: number; gmvChange: number; orders: number; ordersChange: number; platformFee: number; avgOrder: number;
  byCategory: { name: string; value: number }[];
  topShops: { name: string; value: number }[];
}
const RANGES: [number, string][] = [[1, 'Hôm nay'], [7, '7 ngày'], [30, '30 ngày']];
const change = (n: number) => `${n >= 0 ? '+' : ''}${n}% so với kỳ trước`;

export default function AdminReports() {
  const { toast } = useApp();
  const [range, setRange] = useState(7);
  const { data } = useApi<Report>(`/admin/reports?range=${range}`);

  const exportCsv = async () => {
    const res = await fetch(`${API_URL}/admin/reports/export.csv?range=${range}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) return toast('Không xuất được báo cáo');
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-giatot-${range}-ngay.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Đã xuất báo cáo CSV');
  };

  const maxCat = Math.max(1, ...(data?.byCategory.map((c) => c.value) ?? [1]));
  return (
    <>
      <PageTitle actions={<div className="flex gap-1.5">
        {RANGES.map(([k, l]) => <button key={k} onClick={() => setRange(k)} className={`pill ${range === k ? 'pill-on' : 'pill-off'}`}>{l}</button>)}
        <button onClick={exportCsv} className="pill border-brand bg-white font-semibold text-brand">Xuất CSV</button>
      </div>}>Báo cáo doanh thu</PageTitle>
      {!data ? <Loading /> : (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
            <Stat label="GMV" value={`${vnd(data.gmv)}đ`} sub={change(data.gmvChange)} />
            <Stat label="Đơn hàng" value={vnd(data.orders)} sub={change(data.ordersChange)} />
            <Stat label="Phí sàn thu được" value={`${vnd(data.platformFee)}đ`} />
            <Stat label="Giá trị đơn trung bình" value={`${vnd(data.avgOrder)}đ`} />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="card flex flex-[1.3_1_340px] flex-col gap-3 p-5">
              <b>Doanh thu theo danh mục</b>
              {data.byCategory.length === 0 && <span className="text-sm text-muted">Chưa có dữ liệu</span>}
              {data.byCategory.map((c) => <Meter key={c.name} label={c.name} value={`${vnd(c.value)}đ`} pct={(c.value / maxCat) * 100} />)}
            </div>
            <div className="card flex flex-[1_1_300px] flex-col p-5">
              <b className="mb-2">Cửa hàng doanh thu cao</b>
              {data.topShops.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3 border-t border-line py-3 text-[13px]">
                  <b className="w-5 text-muted">{i + 1}</b><span className="flex-1">{s.name}</span><b>{vnd(s.value)}đ</b>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
