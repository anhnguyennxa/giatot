'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Empty, Loading, ProductImage, RequireAuth, Steps } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { vnd } from '@/lib/format';
import type { Order } from '@/lib/types';

const REASONS = ['Hàng bị lỗi hoặc hư hỏng', 'Hàng không đúng mô tả', 'Nhận thiếu hàng', 'Đổi ý, không muốn nhận nữa'];

function Return() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useApp();
  const { data: o, loading } = useApi<Order>(`/orders/${id}`);
  const [reason, setReason] = useState(0);
  const [desc, setDesc] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading && !o) return <Loading />;
  if (!o) return <Empty>Không tìm thấy đơn hàng</Empty>;

  const submit = async () => {
    setBusy(true);
    try {
      await api(`/orders/${o.id}/return`, { body: { reason: REASONS[reason], description: desc } });
      setSent(true);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <b className="text-lg">Trả hàng / Hoàn tiền · {o.code}</b>
      {o.items.map((i) => (
        <div key={i.id} className="flex items-center gap-3"><ProductImage src={i.image} alt={i.name} className="h-[60px] w-[60px] rounded-md" /><span className="text-sm">{i.name} x{i.qty}</span></div>
      ))}
      {sent || o.returnRequest ? (
        <>
          <div className="rounded-lg bg-ok-light p-4 text-sm leading-relaxed text-ok">Yêu cầu đã được gửi. Người bán sẽ phản hồi trong 48 giờ; nếu không đồng ý, Giá Tốt sẽ phân xử.</div>
          <Steps steps={['Đã gửi yêu cầu', 'Xem xét', 'Hoàn tiền']} current={o.returnRequest?.status === 'REFUNDED' ? 2 : 0} />
          <Link href="/orders" className="btn-ghost self-start">Về đơn mua</Link>
        </>
      ) : (
        <>
          <span className="text-[13px] font-semibold">Lý do</span>
          {REASONS.map((r, i) => (
            <button key={r} onClick={() => setReason(i)} className={`rounded-lg border px-3.5 py-3 text-left text-sm ${reason === i ? 'border-brand bg-brand-soft' : 'border-line'}`}>{r}</button>
          ))}
          <textarea rows={3} className="input" placeholder="Mô tả chi tiết vấn đề" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="flex justify-between rounded-lg bg-canvas px-3.5 py-3 text-[13px]"><span>Số tiền hoàn</span><b>{vnd(o.total)}đ</b></div>
          <button disabled={busy} onClick={submit} className="btn-primary py-3">Gửi yêu cầu</button>
        </>
      )}
    </div>
  );
}

export default function ReturnPage() {
  return <RequireAuth><Return /></RequireAuth>;
}
