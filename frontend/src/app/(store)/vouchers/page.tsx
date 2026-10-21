'use client';

import { useRouter } from 'next/navigation';
import { Loading, RequireAuth } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { date, vnd } from '@/lib/format';
import type { Voucher } from '@/lib/types';

interface VData {
  xu: number;
  checkIn: { days: number; doneToday: boolean; rewards: number[] };
  vouchers: (Voucher & { saved: boolean; usedByMe: boolean; soldOut: boolean })[];
}

function Vouchers() {
  const router = useRouter();
  const { toast, refreshUser } = useApp();
  const { data, reload } = useApi<VData>('/vouchers');
  if (!data) return <Loading />;

  const checkIn = async () => {
    try {
      const r = await api<{ reward: number }>('/check-in', { method: 'POST' });
      toast(`Nhận ${r.reward} xu`);
      reload();
      refreshUser();
    } catch (e) { toast((e as Error).message); }
  };
  const save = async (v: Voucher) => {
    await api(`/vouchers/${v.id}/save`, { method: 'POST' });
    toast('Đã lưu voucher');
    reload();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-5 rounded-lg bg-brand p-5 text-white">
        <div className="flex flex-col gap-1"><span className="text-[13px] opacity-90">Xu của bạn</span><b className="text-3xl">{vnd(data.xu)}</b></div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {data.checkIn.rewards.map((x, i) => {
            const done = i < data.checkIn.days;
            const today = i === data.checkIn.days && !data.checkIn.doneToday;
            return (
              <button key={i} disabled={!today} onClick={checkIn}
                className={`flex w-16 flex-col gap-0.5 rounded-lg border border-white/50 py-2 text-[11px] ${done ? 'bg-gold text-ink' : today ? 'bg-white text-brand ring-2 ring-gold' : ''}`}>
                <b className="text-[13px]">+{x}</b>Ngày {i + 1}
              </button>
            );
          })}
        </div>
      </div>
      <b>Voucher</b>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
        {data.vouchers.map((v) => (
          <div key={v.id} className="card flex overflow-hidden border border-line">
            <div className={`flex w-24 flex-none flex-col items-center justify-center gap-0.5 ${v.kind === 'SHIPPING' ? 'bg-ok-light text-ok' : 'bg-brand-light text-brand'}`}>
              <b className="text-xl">{v.kind === 'SHIPPING' ? 'Free' : `${Math.round(v.discount / 1000)}K`}</b>
              <span className="text-[11px]">{v.kind === 'SHIPPING' ? 'Vận chuyển' : 'Giảm giá'}</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1 px-3.5 py-3">
              <b className="text-sm">{v.name}</b>
              <span className="text-xs text-muted">Mã: <b className="text-ink">{v.code}</b> · Đơn tối thiểu {vnd(v.minOrder)}đ{v.shop ? ` · ${v.shop.name}` : ''}</span>
              <span className="text-xs text-brand">{v.expiresAt ? `HSD: ${date(v.expiresAt)}` : 'Không thời hạn'} · Còn {vnd(Math.max(0, v.quantity - v.used))} lượt</span>
              {v.usedByMe ? <span className="mt-1.5 text-xs text-muted">Đã sử dụng</span>
                : v.saved ? <button onClick={() => router.push('/cart')} className="mt-1.5 self-start rounded-md bg-brand px-4 py-1.5 text-xs font-semibold text-white">Dùng ngay</button>
                : <button disabled={v.soldOut} onClick={() => save(v)} className="mt-1.5 self-start rounded-md border border-brand px-4 py-1.5 text-xs font-semibold text-brand disabled:opacity-40">{v.soldOut ? 'Hết lượt' : 'Lưu'}</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VouchersPage() {
  return <RequireAuth><Vouchers /></RequireAuth>;
}
