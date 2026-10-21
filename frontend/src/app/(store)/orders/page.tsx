'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Empty, Loading, ProductImage, RequireAuth, Steps } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { dateTime, ORDER_STATUS, ORDER_STEPS, stepIndex, vnd } from '@/lib/format';
import type { Order, OrderStatus } from '@/lib/types';

const TABS: [string, string][] = [['', 'Tất cả'], ['PENDING_PAYMENT', 'Chờ thanh toán'], ['PENDING', 'Chờ xác nhận'], ['CONFIRMED', 'Chờ lấy hàng'], ['SHIPPING', 'Đang giao'], ['COMPLETED', 'Hoàn thành'], ['CANCELLED', 'Đã hủy']];
const RETURN_LABEL = { PENDING: 'Đang xử lý trả hàng', REFUNDED: 'Đã hoàn tiền', REJECTED: 'Từ chối trả hàng' };

function Orders() {
  const router = useRouter();
  const { toast, refreshCart } = useApp();
  const [tab, setTab] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const { data: orders, loading, reload } = useApi<Order[]>(`/orders${tab ? `?status=${tab}` : ''}`);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); toast(msg); reload(); } catch (e) { toast((e as Error).message); }
  };
  const repay = async (o: Order) => {
    try {
      const r = await api<{ paymentUrl: string }>(`/orders/${o.id}/pay`, { method: 'POST' });
      window.location.href = r.paymentUrl;
    } catch (e) { toast((e as Error).message); }
  };
  const rebuy = async (o: Order) => {
    try {
      for (const i of o.items) await api('/cart', { body: { productId: i.productId, qty: i.qty, variant: i.variant } });
      await refreshCart();
      router.push('/cart');
    } catch (e) { toast((e as Error).message); }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="card flex overflow-x-auto">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 whitespace-nowrap border-b-2 px-3 py-3.5 text-sm font-medium ${tab === k ? 'border-brand text-brand' : 'border-transparent text-muted'}`}>{l}</button>
        ))}
      </div>
      {loading && !orders ? <Loading /> : !orders?.length ? <Empty>Chưa có đơn hàng</Empty> : orders.map((o) => {
        const st = ORDER_STATUS[o.status as OrderStatus];
        const canReview = o.status === 'COMPLETED' && o.items.some((i) => !i.reviewed);
        return (
          <div key={o.id} className="card flex flex-col gap-3 p-4">
            <div className="flex flex-wrap justify-between gap-2.5 text-[13px]">
              <span><b>{o.shop?.name}</b> · {o.code} · <span className="text-muted">{dateTime(o.createdAt)}</span></span>
              <span className="flex gap-3">
                {o.returnRequest && <b className="text-warn">{RETURN_LABEL[o.returnRequest.status]}</b>}
                <b className={st.color}>{st.label}</b>
              </span>
            </div>
            {o.items.map((i) => (
              <Link key={i.id} href={`/product/${i.productId}`} className="flex items-center gap-3 border-t border-line pt-2.5">
                <ProductImage src={i.image} alt={i.name} className="h-[60px] w-[60px] flex-none rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col"><span className="text-[13px]">{i.name}</span>{i.variant && <span className="text-xs text-muted">{i.variant}</span>}</div>
                <span className="text-[13px] text-muted">x{i.qty}</span>
                <span className="w-24 text-right text-[13px]">{vnd(i.price * i.qty)}đ</span>
              </Link>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-line pt-3">
              <span className="text-sm">Thành tiền: <b className="text-lg text-brand">{vnd(o.total)}đ</b> <span className="text-xs text-muted">· {o.paymentMethod === 'VNPAY' ? 'VNPay' : 'COD'}{o.paymentStatus === 'PAID' ? ' (đã thanh toán)' : o.paymentStatus === 'REFUNDED' ? ' (đã hoàn tiền)' : ''}</span></span>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setOpen(open === o.id ? null : o.id)} className="btn-ghost py-2">{open === o.id ? 'Ẩn' : 'Theo dõi đơn hàng'}</button>
                {o.status === 'PENDING_PAYMENT' && <button onClick={() => repay(o)} className="btn-primary py-2">Thanh toán VNPay</button>}
                {(o.status === 'PENDING_PAYMENT' || o.status === 'PENDING') && (
                  <button onClick={() => confirm('Hủy đơn hàng này?') && act(() => api(`/orders/${o.id}/cancel`, { body: { reason: 'Người mua hủy đơn' } }), 'Đã hủy đơn')} className="btn-danger py-2">Hủy đơn</button>
                )}
                {o.status === 'SHIPPING' && <button onClick={() => act(() => api(`/orders/${o.id}/received`, { method: 'POST' }), 'Cảm ơn bạn! Đơn đã hoàn thành')} className="btn-primary py-2">Đã nhận hàng</button>}
                {canReview && <Link href={`/orders/${o.id}/review`} className="btn-outline py-2">Đánh giá</Link>}
                {(o.status === 'COMPLETED' || o.status === 'SHIPPING') && !o.returnRequest && <Link href={`/orders/${o.id}/return`} className="btn-ghost py-2">Trả hàng/Hoàn tiền</Link>}
                {(o.status === 'COMPLETED' || o.status === 'CANCELLED') && <button onClick={() => rebuy(o)} className="btn-primary py-2">Mua lại</button>}
              </div>
            </div>
            {open === o.id && (
              <div className="flex flex-col gap-3 rounded-lg bg-canvas p-4 text-[13px]">
                <Steps steps={ORDER_STEPS} current={stepIndex(o.status)} cancelled={o.status === 'CANCELLED'} />
                <div className="grid gap-1 sm:grid-cols-2">
                  <span>Người nhận: <b>{o.shipName}</b> · {o.shipPhone}</span>
                  <span>Vận chuyển: {o.shippingService}</span>
                  <span className="sm:col-span-2 text-muted">{o.shipAddress}</span>
                  {o.ghnOrderCode && <span>Mã vận đơn GHN: <b>{o.ghnOrderCode}</b></span>}
                  {o.expectedDelivery && <span>Dự kiến giao: {dateTime(o.expectedDelivery)}</span>}
                  {o.cancelReason && <span className="text-red-700">Lý do hủy: {o.cancelReason}</span>}
                </div>
                <div className="flex flex-wrap gap-x-5 text-muted">
                  <span>Tiền hàng {vnd(o.subtotal)}đ</span><span>Phí ship {vnd(o.shippingFee)}đ</span><span>Giảm {vnd(o.discount)}đ</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OrdersPage() {
  return <RequireAuth><Orders /></RequireAuth>;
}
