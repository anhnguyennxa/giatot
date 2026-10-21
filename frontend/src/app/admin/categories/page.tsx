'use client';

import { useState } from 'react';
import { PageTitle } from '@/components/DashboardShell';
import { Loading } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';

interface Cat {
  id: number; name: string; visible: boolean; parentId: number | null;
  brands: { id: number; name: string }[]; _count: { products: number };
}
const PAL = ['#1F4E9C', '#B4401F', '#4A6B17', '#6B4524', '#0F6B62', '#4B3A9C'];

export default function AdminCategories() {
  const { toast } = useApp();
  const { data, reload } = useApi<Cat[]>('/admin/categories');
  const [sel, setSel] = useState<number | null>(null);
  const [newCat, setNewCat] = useState('');
  const [newSub, setNewSub] = useState('');
  const [newBrand, setNewBrand] = useState('');
  if (!data) return <Loading />;

  const roots = data.filter((c) => !c.parentId);
  const cat = roots.find((c) => c.id === sel) ?? roots[0];
  const subs = data.filter((c) => c.parentId === cat?.id);
  const call = async (path: string, body?: unknown, method = 'POST', msg?: string) => {
    try { await api(path, { method, body }); if (msg) toast(msg); reload(); } catch (e) { toast((e as Error).message); }
  };

  return (
    <>
      <PageTitle>Danh mục và thương hiệu</PageTitle>
      <div className="flex flex-wrap items-start gap-3">
        <div className="card flex w-full flex-col gap-0.5 p-2.5 md:w-64">
          {roots.map((c) => (
            <button key={c.id} onClick={() => setSel(c.id)} className={`flex items-center justify-between rounded-md px-3 py-2.5 text-left text-sm ${cat?.id === c.id ? 'bg-brand-light text-brand' : 'hover:bg-canvas'}`}>
              <span>{c.name}</span>
              <span className={`text-[11px] ${c.visible ? 'text-muted' : 'text-red-700'}`}>{c.visible ? `${c.brands.length} thương hiệu` : 'Đã ẩn'}</span>
            </button>
          ))}
          <div className="flex gap-1.5 px-0.5 pt-2">
            <input className="input py-2 text-[13px]" placeholder="Danh mục mới" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            <button onClick={() => newCat.trim() && call('/admin/categories', { name: newCat.trim() }, 'POST', 'Đã thêm danh mục').then(() => setNewCat(''))} className="btn-primary px-3 py-2">Thêm</button>
          </div>
        </div>
        {cat && (
          <div className="card flex min-w-0 flex-1 basis-96 flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <b className="text-lg">{cat.name} <span className="text-sm font-normal text-muted">· {cat._count.products + subs.reduce((a, s) => a + s._count.products, 0)} sản phẩm</span></b>
              <button onClick={() => call(`/admin/categories/${cat.id}`, { visible: !cat.visible }, 'PATCH')} className="btn-ghost py-2">{cat.visible ? 'Ẩn danh mục' : 'Hiển thị danh mục'}</button>
            </div>
            <b className="section-title">Danh mục con ({subs.length})</b>
            <div className="flex flex-wrap gap-2">
              {subs.map((s) => (
                <button key={s.id} onClick={() => call(`/admin/categories/${s.id}`, { visible: !s.visible }, 'PATCH')} title="Bấm để ẩn/hiện"
                  className={`chip ${s.visible ? 'chip-off' : 'border-line bg-canvas text-muted line-through'}`}>{s.name} · {s._count.products}</button>
              ))}
            </div>
            <div className="flex max-w-md gap-2">
              <input className="input" placeholder="Tên danh mục con" value={newSub} onChange={(e) => setNewSub(e.target.value)} />
              <button onClick={() => newSub.trim() && call('/admin/categories', { name: newSub.trim(), parentId: cat.id }, 'POST', 'Đã thêm danh mục con').then(() => setNewSub(''))} className="btn-outline">Thêm</button>
            </div>
            <b className="section-title">Thương hiệu nổi bật ({cat.brands.length})</b>
            <div className="flex flex-wrap gap-2.5">
              {cat.brands.map((b, i) => (
                <div key={b.id} className="flex items-center gap-2 rounded-lg border border-line py-2 pl-2.5 pr-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md text-[13px] font-bold text-white" style={{ background: PAL[i % PAL.length] }}>{b.name[0]}</div>
                  <span className="text-[13px] font-medium">{b.name}</span>
                  <button onClick={() => call(`/admin/brands/${b.id}`, undefined, 'DELETE')} className="text-sm text-muted hover:text-red-700" aria-label={`Xóa ${b.name}`}>✕</button>
                </div>
              ))}
            </div>
            <div className="flex max-w-md gap-2">
              <input className="input" placeholder="Tên thương hiệu mới" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} />
              <button onClick={() => newBrand.trim() && call(`/admin/categories/${cat.id}/brands`, { name: newBrand.trim() }, 'POST', 'Đã thêm thương hiệu').then(() => setNewBrand(''))} className="btn-primary">Thêm</button>
            </div>
            <span className="text-xs text-muted">Các thương hiệu này hiển thị ở đầu trang danh mục của người mua.</span>
          </div>
        )}
      </div>
    </>
  );
}
