'use client';

import { useState } from 'react';
import { PageTitle } from '@/components/DashboardShell';
import { Loading, StatusBadge } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { date, vnd } from '@/lib/format';
import type { Voucher } from '@/lib/types';

const EMPTY = { name: '', code: '', discount: '', minOrder: '', quantity: '1000', kind: 'DISCOUNT', expiresAt: '' };

export default function AdminVouchers() {
  const { toast } = useApp();
  const { data, reload } = useApi<Voucher[]>('/admin/vouchers');
  const [f, setF] = useState(EMPTY);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/admin/vouchers', {
        body: { name: f.name, code: f.code || undefined, discount: +f.discount, minOrder: +f.minOrder || 0, quantity: +f.quantity || 1000, kind: f.kind, expiresAt: f.expiresAt || undefined },
      });
      setF(EMPTY);
      toast('Đã tạo voucher sàn');
      reload();
    } catch (e2) { toast((e2 as Error).message); }
  };

  return (
    <>
      <PageTitle>Voucher sàn</PageTitle>
      <div className="flex flex-wrap items-start gap-3.5">
        <form onSubmit={create} className="card flex flex-1 basis-80 flex-col gap-3 p-5">
          <b>Tạo voucher</b>
          <input required className="input" placeholder="Tên chương trình" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="input uppercase" placeholder="Mã (bỏ trống để tự sinh)" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
          <div className="flex gap-2.5">
            <input required type="number" min={1000} className="input" placeholder="Giảm (đ)" value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} />
            <input type="number" className="input" placeholder="Đơn tối thiểu" value={f.minOrder} onChange={(e) => setF({ ...f, minOrder: e.target.value })} />
          </div>
          <div className="flex gap-2.5">
            <input type="number" className="input" placeholder="Số lượt" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />
            <input type="date" className="input" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} aria-label="Hạn sử dụng" />
          </div>
          <div className="flex gap-2">
            {[['DISCOUNT', 'Giảm giá'], ['SHIPPING', 'Vận chuyển']].map(([k, l]) => (
              <button type="button" key={k} onClick={() => setF({ ...f, kind: k })} className={`pill flex-1 rounded-md ${f.kind === k ? 'pill-on' : 'pill-off'}`}>{l}</button>
            ))}
          </div>
          <button className="btn-primary">Tạo voucher</button>
        </form>
        <div className="card flex flex-[1.5_1_380px] flex-col p-5">
          <b className="mb-2">Chương trình hiện có</b>
          {!data ? <Loading /> : data.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-2.5 border-t border-line py-3.5">
              <div className="flex flex-col gap-0.5">
                <b className="text-sm">{v.name} <span className="font-mono text-xs text-brand">{v.code}</span></b>
                <span className="text-xs text-muted">{v.kind === 'SHIPPING' ? 'Vận chuyển' : 'Giảm giá'} · Giảm {vnd(v.discount)}đ · Đơn từ {vnd(v.minOrder)}đ · Đã dùng {vnd(v.used)}/{vnd(v.quantity)}{v.expiresAt && ` · HSD ${date(v.expiresAt)}`}</span>
              </div>
              <StatusBadge on={v.active} onLabel="Đang chạy" offLabel="Tạm dừng" onClick={async () => { await api(`/admin/vouchers/${v.id}/toggle`, { method: 'POST' }); reload(); }} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
