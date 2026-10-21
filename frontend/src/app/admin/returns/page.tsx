'use client';

import { useState } from 'react';
import { PageTitle } from '@/components/DashboardShell';
import { Empty, Loading } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { dateTime, vnd } from '@/lib/format';

interface Row {
  id: number; code: string; reason: string; description: string; amount: number; status: 'PENDING' | 'REFUNDED' | 'REJECTED'; createdAt: string;
  user: { name: string };
  order: { code: string; shop: { name: string }; items: { name: string; qty: number }[] };
}
const TABS: [string, string][] = [['', 'Tất cả'], ['PENDING', 'Đang chờ'], ['REFUNDED', 'Đã hoàn tiền'], ['REJECTED', 'Đã từ chối']];
const ST = { PENDING: ['Đang chờ', 'text-warn'], REFUNDED: ['Đã hoàn tiền', 'text-ok'], REJECTED: ['Đã từ chối', 'text-red-700'] } as const;

export default function AdminReturns() {
  const { toast } = useApp();
  const [tab, setTab] = useState('PENDING');
  const { data, reload } = useApi<Row[]>(`/admin/returns${tab ? `?status=${tab}` : ''}`);
  const act = async (r: Row, refund: boolean) => {
    try {
      await api(`/admin/returns/${r.id}/${refund ? 'refund' : 'reject'}`, { method: 'POST' });
      toast(refund ? `Đã hoàn ${vnd(r.amount)}đ cho ${r.user.name}` : 'Đã từ chối khiếu nại');
      reload();
    } catch (e) { toast((e as Error).message); }
  };
  return (
    <>
      <PageTitle>Khiếu nại và hoàn tiền</PageTitle>
      <div className="flex flex-wrap gap-2">{TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`pill ${tab === k ? 'pill-on' : 'pill-off'}`}>{l}</button>)}</div>
      {!data ? <Loading /> : data.length === 0 ? <Empty>Không có khiếu nại</Empty> : (
        <div className="flex flex-col gap-2.5">
          {data.map((r) => (
            <div key={r.id} className="card flex flex-col gap-3 px-5 py-4">
              <div className="flex flex-wrap justify-between gap-2.5">
                <b className="text-sm">{r.code} · Đơn {r.order.code} · {r.order.items.map((i) => `${i.name} x${i.qty}`).join(', ')}</b>
                <b className={`text-[13px] ${ST[r.status][1]}`}>{ST[r.status][0]}</b>
              </div>
              <div className="flex flex-wrap gap-6 text-[13px] text-muted">
                <span>Người mua: <b className="text-ink">{r.user.name}</b></span>
                <span>Người bán: <b className="text-ink">{r.order.shop.name}</b></span>
                <span>Số tiền: <b className="text-brand">{vnd(r.amount)}đ</b></span>
                <span>{dateTime(r.createdAt)}</span>
              </div>
              <div className="rounded-md bg-canvas px-3.5 py-3 text-[13px] leading-relaxed"><b>{r.reason}.</b> {r.description}</div>
              {r.status === 'PENDING' && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => act(r, true)} className="btn-primary">Hoàn tiền cho người mua</button>
                  <button onClick={() => act(r, false)} className="btn-danger">Từ chối khiếu nại</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
