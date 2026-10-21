'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import type { Category } from '@/lib/types';
import { ProductImage } from './ui';

export interface ProductInput {
  id?: number;
  name: string;
  categoryId: number;
  brandId: number | null;
  description: string;
  price: number;
  originalPrice: number | null;
  stock: number;
  weight: number;
  images: string[];
  options: { name: string; values: string[] }[];
  freeShip: boolean;
}

export const EMPTY_PRODUCT: ProductInput = {
  name: '', categoryId: 0, brandId: null, description: '', price: 0, originalPrice: null, stock: 0, weight: 300,
  images: ['', '', '', '', ''], options: [], freeShip: false,
};

export function ProductForm({ initial }: { initial: ProductInput }) {
  const router = useRouter();
  const { toast } = useApp();
  const { data: cats } = useApi<Category[]>('/categories');
  const [f, setF] = useState<ProductInput>({ ...initial, images: [...initial.images, '', '', '', '', ''].slice(0, 5) });
  const [optText, setOptText] = useState(initial.options.map((o) => `${o.name}: ${o.values.join(', ')}`).join('\n'));
  const [busy, setBusy] = useState(false);

  const root = cats?.find((c) => c.id === f.categoryId || c.children?.some((s) => s.id === f.categoryId));
  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setF({ ...f, [k]: v });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.name.trim().length < 10) return toast('Tên sản phẩm tối thiểu 10 ký tự');
    if (!f.categoryId) return toast('Chọn ngành hàng');
    const options = optText.split('\n').map((l) => l.split(':')).filter((p) => p.length === 2 && p[0].trim())
      .map(([n, v]) => ({ name: n.trim(), values: v.split(',').map((x) => x.trim()).filter(Boolean) }));
    setBusy(true);
    try {
      const body = { ...f, id: undefined, images: f.images.map((s) => s.trim()).filter(Boolean), options, originalPrice: f.originalPrice || null };
      await api(f.id ? `/seller/products/${f.id}` : '/seller/products', { method: f.id ? 'PUT' : 'POST', body });
      toast(f.id ? 'Đã lưu thay đổi' : 'Đã đăng sản phẩm, chờ Giá Tốt duyệt');
      router.push('/seller/products');
    } catch (e2) {
      toast((e2 as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex max-w-3xl flex-col gap-4">
      <div className="card flex flex-col gap-3.5 p-5">
        <b>Hình ảnh (dán đường dẫn URL ảnh)</b>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))' }}>
          {f.images.map((src, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              {src ? <ProductImage src={src} alt="" className="aspect-square w-full rounded-lg" />
                : <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-muted/50 text-xs text-muted">{i === 0 ? 'Ảnh bìa' : `Ảnh ${i + 1}`}</div>}
              <input className="input px-2 py-1.5 text-xs" placeholder="https://..." value={src} onChange={(e) => set('images', f.images.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
        </div>
      </div>
      <div className="card flex flex-col gap-3.5 p-5">
        <b>Thông tin cơ bản</b>
        <label className="label">Tên sản phẩm<input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Tối thiểu 10 ký tự" /></label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="label">Ngành hàng
            <select className="input" value={root?.id ?? 0} onChange={(e) => setF({ ...f, categoryId: +e.target.value, brandId: null })}>
              <option value={0}>-- Chọn --</option>
              {cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="label">Danh mục con
            <select className="input" value={f.categoryId} onChange={(e) => set('categoryId', +e.target.value || (root?.id ?? 0))} disabled={!root?.children?.length}>
              <option value={root?.id ?? 0}>-- Không chọn --</option>
              {root?.children?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="label">Thương hiệu
            <select className="input" value={f.brandId ?? 0} onChange={(e) => set('brandId', +e.target.value || null)} disabled={!root?.brands?.length}>
              <option value={0}>Không thương hiệu</option>
              {root?.brands?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        </div>
        <label className="label">Mô tả<textarea rows={5} className="input" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Mô tả chi tiết sản phẩm" /></label>
        <label className="label">Phân loại (mỗi dòng: Tên: giá trị 1, giá trị 2)
          <textarea rows={3} className="input font-mono text-xs" value={optText} onChange={(e) => setOptText(e.target.value)} placeholder={'Màu sắc: Đen, Trắng\nKích cỡ: S, M, L'} />
        </label>
      </div>
      <div className="card flex flex-col gap-3.5 p-5">
        <b>Giá, kho hàng và vận chuyển</b>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="label">Giá bán (đ)<input type="number" min={1000} className="input" value={f.price || ''} onChange={(e) => set('price', +e.target.value)} /></label>
          <label className="label">Giá gốc (đ)<input type="number" className="input" value={f.originalPrice || ''} onChange={(e) => set('originalPrice', +e.target.value || null)} /></label>
          <label className="label">Kho hàng<input type="number" min={0} className="input" value={f.stock} onChange={(e) => set('stock', +e.target.value)} /></label>
          <label className="label">Cân nặng (gram)<input type="number" min={50} className="input" value={f.weight} onChange={(e) => set('weight', +e.target.value)} /></label>
        </div>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="accent-brand" checked={f.freeShip} onChange={(e) => set('freeShip', e.target.checked)} />Miễn phí vận chuyển cho đơn từ 150.000đ (shop chịu phí GHN)</label>
      </div>
      <div className="flex gap-2.5">
        <button disabled={busy} className="btn-primary px-8 py-3">{f.id ? 'Lưu thay đổi' : 'Đăng sản phẩm'}</button>
        <button type="button" onClick={() => router.push('/seller/products')} className="btn-ghost px-6 py-3">Hủy</button>
      </div>
    </form>
  );
}
