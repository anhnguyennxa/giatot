'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PageTitle } from '@/components/DashboardShell';
import { Empty, Loading, ProductImage } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { vnd } from '@/lib/format';

interface Row {
  id: number; name: string; price: number; images: string[]; flag: string | null; status: 'PENDING' | 'APPROVED' | 'REJECTED';
  shop: { name: string }; category: { name: string };
}
const TABS: [string, string][] = [['PENDING', 'Chờ duyệt'], ['APPROVED', 'Đã duyệt'], ['REJECTED', 'Đã gỡ'], ['', 'Tất cả']];
const ST = { PENDING: ['Chờ duyệt', 'text-warn'], APPROVED: ['Đã duyệt', 'text-ok'], REJECTED: ['Đã gỡ', 'text-red-700'] } as const;

export default function AdminProducts() {
  const { toast } = useApp();
  const [tab, setTab] = useState('PENDING');
  const [q, setQ] = useState('');
  const qs = new URLSearchParams();
  if (tab) qs.set('status', tab);
  if (q) qs.set('q', q);
  const { data, reload } = useApi<Row[]>(`/admin/products?${qs.toString()}`);

  const approve = async (p: Row) => { await api(`/admin/products/${p.id}/approve`, { method: 'POST' }); toast('Đã duyệt sản phẩm'); reload(); };
  const reject = async (p: Row) => {
    const reason = prompt('Lý do gỡ sản phẩm', p.flag ?? 'Vi phạm chính sách đăng bán');
    if (reason === null) return;
    await api(`/admin/products/${p.id}/reject`, { body: { reason } });
    toast('Đã gỡ sản phẩm');
    reload();
  };

  return (
    <>
      <PageTitle actions={<input className="input w-60" placeholder="Tìm sản phẩm" value={q} onChange={(e) => setQ(e.target.value)} />}>Duyệt sản phẩm</PageTitle>
      <div className="flex flex-wrap gap-2">{TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`pill ${tab === k ? 'pill-on' : 'pill-off'}`}>{l}</button>)}</div>
      {!data ? <Loading /> : data.length === 0 ? <Empty>Không có sản phẩm</Empty> : (
        <div className="flex flex-col gap-2.5">
          {data.map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center gap-4 px-5 py-4">
              <ProductImage src={p.images[0]} alt="" className="h-[60px] w-[60px] flex-none rounded-md" />
              <div className="flex flex-1 basis-60 flex-col gap-0.5">
                {p.status === 'APPROVED' ? <Link href={`/product/${p.id}`} className="text-sm font-semibold hover:text-brand">{p.name}</Link> : <b className="text-sm">{p.name}</b>}
                <span className="text-xs text-muted">{p.shop.name} · {p.category.name} · {vnd(p.price)}đ</span>
                <span className={`text-xs ${p.flag ? 'text-red-700' : 'text-muted'}`}>{p.flag ? `Cảnh báo: ${p.flag}` : 'Không có cảnh báo'}</span>
              </div>
              <b className={`text-[13px] ${ST[p.status][1]}`}>{ST[p.status][0]}</b>
              <div className="flex gap-2">
                {p.status !== 'APPROVED' && <button onClick={() => approve(p)} className="btn-primary py-2">Duyệt</button>}
                {p.status !== 'REJECTED' && <button onClick={() => reject(p)} className="btn-danger py-2">Gỡ</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
