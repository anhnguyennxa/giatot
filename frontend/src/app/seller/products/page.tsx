'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PageTitle } from '@/components/DashboardShell';
import { Loading, ProductImage, StatusBadge } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { vnd } from '@/lib/format';

interface Row {
  id: number; name: string; price: number; stock: number; sold: number; visible: boolean; images: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED'; flag: string | null; category: { name: string };
}

const REVIEW = { PENDING: ['Chờ duyệt', 'text-warn'], APPROVED: ['Đã duyệt', 'text-ok'], REJECTED: ['Bị gỡ', 'text-red-700'] } as const;

export default function SellerProducts() {
  const { toast } = useApp();
  const [q, setQ] = useState('');
  const [del, setDel] = useState<number | null>(null);
  const { data, reload } = useApi<Row[]>(`/seller/products${q ? `?q=${encodeURIComponent(q)}` : ''}`);

  const toggle = async (p: Row) => { await api(`/seller/products/${p.id}/toggle`, { method: 'POST' }); reload(); };
  const remove = async (p: Row) => {
    if (del !== p.id) return setDel(p.id);
    const r = await api<{ hidden: boolean }>(`/seller/products/${p.id}`, { method: 'DELETE' });
    toast(r.hidden ? 'Sản phẩm đã có đơn nên được ẩn thay vì xóa' : 'Đã xóa sản phẩm');
    setDel(null);
    reload();
  };

  return (
    <>
      <PageTitle actions={<>
        <input className="input w-56" placeholder="Tìm sản phẩm" value={q} onChange={(e) => setQ(e.target.value)} />
        <Link href="/seller/products/new" className="btn-primary">+ Thêm sản phẩm</Link>
      </>}>Sản phẩm ({data?.length ?? 0})</PageTitle>
      {!data ? <Loading /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead><tr>{['Sản phẩm', 'Giá', 'Kho', 'Đã bán', 'Kiểm duyệt', 'Hiển thị', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id}>
                  <td className="td">
                    <div className="flex items-center gap-2.5">
                      <ProductImage src={p.images[0]} alt="" className="h-11 w-11 flex-none rounded-md" />
                      <div className="flex flex-col"><span>{p.name}</span><span className="text-xs text-muted">{p.category.name}</span></div>
                    </div>
                  </td>
                  <td className="td">{vnd(p.price)}đ</td>
                  <td className={`td ${p.stock === 0 ? 'text-red-700' : p.stock < 10 ? 'text-warn' : ''}`}>{p.stock === 0 ? 'Hết hàng' : p.stock}</td>
                  <td className="td">{vnd(p.sold)}</td>
                  <td className="td"><b className={REVIEW[p.status][1]}>{REVIEW[p.status][0]}</b>{p.flag && <div className="text-xs text-muted">{p.flag}</div>}</td>
                  <td className="td"><StatusBadge on={p.visible} onLabel="Đang bán" offLabel="Ẩn" onClick={() => toggle(p)} /></td>
                  <td className="td">
                    <div className="flex gap-1.5">
                      <Link href={`/seller/products/${p.id}`} className="btn-ghost px-3 py-1.5 text-xs">Sửa</Link>
                      <button onClick={() => remove(p)} className={`btn px-3 py-1.5 text-xs ${del === p.id ? 'bg-red-700 text-white' : 'border border-line bg-white font-medium'}`}>{del === p.id ? 'Xác nhận?' : 'Xóa'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
