'use client';

import { useState } from 'react';
import { PageTitle } from '@/components/DashboardShell';
import { Empty, Loading, Toggle } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { date } from '@/lib/format';

interface ShopRow {
  id: number; name: string; businessType: string; city: string | null; documents: string | null; idNumber: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED'; isMall: boolean; createdAt: string;
  owner: { name: string; email: string; phone: string | null }; _count: { products: number; orders: number };
}

const TABS: [string, string][] = [['', 'Tất cả'], ['PENDING', 'Chờ duyệt'], ['APPROVED', 'Đã duyệt'], ['REJECTED', 'Đã từ chối']];
const ST = { PENDING: ['Chờ duyệt', 'text-warn'], APPROVED: ['Đã duyệt', 'text-ok'], REJECTED: ['Đã từ chối', 'text-red-700'] } as const;

export default function AdminSellers() {
  const { toast } = useApp();
  const [tab, setTab] = useState('PENDING');
  const { data, reload } = useApi<ShopRow[]>(`/admin/shops${tab ? `?status=${tab}` : ''}`);
  const act = async (s: ShopRow, path: string, body?: unknown, msg?: string) => { await api(`/admin/shops/${s.id}/${path}`, { method: 'POST', body }); if (msg) toast(msg); reload(); };

  return (
    <>
      <PageTitle>Duyệt người bán</PageTitle>
      <div className="flex flex-wrap gap-2">{TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`pill ${tab === k ? 'pill-on' : 'pill-off'}`}>{l}</button>)}</div>
      {!data ? <Loading /> : data.length === 0 ? <Empty>Không có hồ sơ</Empty> : (
        <div className="flex flex-col gap-2.5">
          {data.map((s) => (
            <div key={s.id} className="card flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-light font-bold text-brand">{s.name[0]}</div>
              <div className="flex flex-1 basis-60 flex-col gap-0.5">
                <b>{s.name}</b>
                <span className="text-xs text-muted">{s.businessType} · {s.city ?? '—'} · Gửi {date(s.createdAt)} · {s.owner.name} ({s.owner.email})</span>
                <span className="text-xs text-ink-soft">{s.documents ?? 'Chưa có giấy tờ'}{s.idNumber && ` · CCCD ${s.idNumber}`}</span>
                {s.status === 'APPROVED' && <span className="text-xs text-muted">{s._count.products} sản phẩm · {s._count.orders} đơn hàng</span>}
              </div>
              {s.status === 'APPROVED' && (
                <label className="flex items-center gap-2 text-xs text-muted">Mall <Toggle on={s.isMall} label="Mall" onClick={() => act(s, 'mall', { isMall: !s.isMall })} /></label>
              )}
              <b className={`text-[13px] ${ST[s.status][1]}`}>{ST[s.status][0]}</b>
              {s.status !== 'APPROVED' && (
                <div className="flex gap-2">
                  <button onClick={() => act(s, 'approve', undefined, `Đã duyệt ${s.name}`)} className="btn-primary py-2">Duyệt</button>
                  {s.status === 'PENDING' && <button onClick={() => act(s, 'reject', undefined, `Đã từ chối ${s.name}`)} className="btn-danger py-2">Từ chối</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
