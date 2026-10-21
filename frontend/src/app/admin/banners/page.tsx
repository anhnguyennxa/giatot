'use client';

import { useState } from 'react';
import { PageTitle } from '@/components/DashboardShell';
import { Loading, StatusBadge } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { date } from '@/lib/format';
import type { Banner } from '@/lib/types';

export default function AdminBanners() {
  const { toast } = useApp();
  const { data, reload, setData } = useApi<Banner[]>('/admin/banners');
  const [f, setF] = useState({ title: '', subtitle: '', link: '', endsAt: '' });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/admin/banners', { body: { title: f.title, subtitle: f.subtitle || undefined, link: f.link || undefined, endsAt: f.endsAt || undefined } });
      setF({ title: '', subtitle: '', link: '', endsAt: '' });
      toast('Đã thêm banner');
      reload();
    } catch (e2) { toast((e2 as Error).message); }
  };
  const move = async (b: Banner, dir: number) => setData(await api<Banner[]>(`/admin/banners/${b.id}/move`, { body: { dir } }));

  return (
    <>
      <PageTitle>Banner trang chủ</PageTitle>
      {!data ? <Loading /> : (
        <div className="flex flex-col gap-2.5">
          {data.map((b, i) => (
            <div key={b.id} className={`card flex flex-wrap items-center gap-3.5 px-4 py-3.5 ${b.active ? '' : 'opacity-60'}`}>
              <div className={`flex h-16 w-40 flex-none items-end rounded-md p-2 text-[11px] font-semibold ${i === 0 ? 'bg-brand text-white' : 'bg-gold-light text-gold-dark'}`}>banner {i + 1}</div>
              <div className="flex flex-1 basis-56 flex-col gap-0.5">
                <b className="text-sm">{b.title}</b>
                <span className="text-xs text-muted">Vị trí {i === 0 ? 'chính' : `phụ ${i}`}{b.subtitle && ` · ${b.subtitle}`}{b.endsAt && ` · đến ${date(b.endsAt)}`}{b.link && ` · ${b.link}`}</span>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => move(b, -1)} className="h-9 w-9 rounded-md border border-line bg-white" aria-label="Lên">↑</button>
                <button onClick={() => move(b, 1)} className="h-9 w-9 rounded-md border border-line bg-white" aria-label="Xuống">↓</button>
                <StatusBadge on={b.active} onLabel="Đang hiện" offLabel="Đã ẩn" onClick={async () => { await api(`/admin/banners/${b.id}`, { method: 'PATCH', body: { active: !b.active } }); reload(); }} />
                <button onClick={async () => { if (confirm('Xóa banner này?')) { await api(`/admin/banners/${b.id}`, { method: 'DELETE' }); reload(); } }} className="px-2 text-sm text-muted hover:text-red-700">Xóa</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={add} className="card grid gap-2.5 p-4 sm:grid-cols-[2fr_2fr_1.5fr_1fr_auto]">
        <input required className="input" placeholder="Tên chiến dịch banner mới" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <input className="input" placeholder="Dòng phụ" value={f.subtitle} onChange={(e) => setF({ ...f, subtitle: e.target.value })} />
        <input className="input" placeholder="Liên kết, vd /search?q=giay" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
        <input type="date" className="input" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} aria-label="Ngày kết thúc" />
        <button className="btn-primary">Thêm banner</button>
      </form>
    </>
  );
}
