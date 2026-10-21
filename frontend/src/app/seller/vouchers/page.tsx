'use client';

import { useState } from 'react';
import { PageTitle } from '@/components/DashboardShell';
import { Loading, StatusBadge } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { vnd } from '@/lib/format';
import type { Voucher } from '@/lib/types';

export default function SellerVouchers() {
  const { toast } = useApp();
  const { data, reload } = useApi<Voucher[]>('/seller/vouchers');
  const [f, setF] = useState({ name: '', discount: '', minOrder: '', quantity: '100', kind: 'DISCOUNT' });
  const [del, setDel] = useState<number | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/seller/vouchers', { body: { name: f.name, discount: +f.discount, minOrder: +f.minOrder || 0, quantity: +f.quantity || 100, kind: f.kind } });
      setF({ name: '', discount: '', minOrder: '', quantity: '100', kind: 'DISCOUNT' });
      toast('Đã tạo voucher');
      reload();
    } catch (e2) { toast((e2 as Error).message); }
  };

  return (
    <>
      <PageTitle>Khuyến mãi và voucher</PageTitle>
      <div className="flex flex-wrap items-start gap-3.5">
        <form onSubmit={create} className="card flex flex-1 basis-80 flex-col gap-3 p-5">
          <b>Tạo voucher mới</b>
          <label className="label">Tên chương trình<input required className="input" placeholder="Ví dụ: Giảm 20K đơn từ 200K" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <div className="flex gap-2">
            {[['DISCOUNT', 'Giảm giá'], ['SHIPPING', 'Hỗ trợ phí ship']].map(([k, l]) => (
              <button type="button" key={k} onClick={() => setF({ ...f, kind: k })} className={`chip flex-1 rounded-md py-2 ${f.kind === k ? 'chip-on' : 'chip-off'}`}>{l}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <label className="label">Giảm (đ)<input required type="number" min={1000} className="input" value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} /></label>
            <label className="label">Đơn tối thiểu<input type="number" className="input" value={f.minOrder} onChange={(e) => setF({ ...f, minOrder: e.target.value })} /></label>
            <label className="label">Số lượt<input type="number" className="input" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></label>
          </div>
          <button className="btn-primary">Tạo voucher</button>
        </form>
        <div className="card flex flex-[1.5_1_380px] flex-col p-5">
          <b className="mb-2">Chương trình của shop</b>
          {!data ? <Loading /> : data.length === 0 ? <span className="text-sm text-muted">Chưa có voucher</span> : data.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-2.5 border-t border-line py-3.5">
              <div className="flex flex-col gap-0.5">
                <b className="text-sm">{v.name}</b>
                <span className="text-xs text-muted">Mã {v.code} · {v.kind === 'SHIPPING' ? 'Hỗ trợ ship' : 'Giảm'} {vnd(v.discount)}đ · Đơn từ {vnd(v.minOrder)}đ · Đã dùng {v.used}/{v.quantity}</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge on={v.active} onLabel="Đang chạy" offLabel="Tạm dừng" onClick={async () => { await api(`/seller/vouchers/${v.id}`, { method: 'PATCH', body: { active: !v.active } }); reload(); }} />
                <button onClick={async () => { if (del !== v.id) return setDel(v.id); await api(`/seller/vouchers/${v.id}`, { method: 'DELETE' }); setDel(null); reload(); }}
                  className={`btn px-3 py-1.5 text-xs ${del === v.id ? 'bg-red-700 text-white' : 'border border-line bg-white font-medium'}`}>{del === v.id ? 'Xác nhận?' : 'Xóa'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
