'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Loading, ProductImage, Steps } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { dateTime, escapeHtml as h, ORDER_STATUS, ORDER_STEPS, SELLER_ACTION, stepIndex, vnd } from '@/lib/format';
import type { Order } from '@/lib/types';

export default function SellerOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useApp();
  const { data: o, reload } = useApi<Order & { platformFee: number; net: number }>(`/seller/orders/${id}`);
  if (!o) return <Loading />;

  const run = async (path: string, body?: unknown, msg = 'Đã cập nhật đơn') => {
    try { await api(`/seller/${path}`, { method: 'POST', body }); toast(msg); reload(); } catch (e) { toast((e as Error).message); }
  };
  const a = SELLER_ACTION[o.status];
  const printSlip = () => {
    const w = window.open('', '_blank', 'width=480,height=640');
    if (!w) return;
    w.document.write(`<html><head><title>Phiếu giao hàng ${o.code}</title></head><body style="font-family:sans-serif;padding:16px">
      <h2>GIÁ TỐT · Phiếu giao hàng</h2><p>Mã đơn: <b>${o.code}</b><br/>Mã vận đơn GHN: <b>${o.ghnOrderCode ?? '-'}</b></p>
      <p>Người nhận: <b>${h(o.shipName)}</b> · ${h(o.shipPhone)}<br/>${h(o.shipAddress)}</p>
      <ul>${o.items.map((i) => `<li>${h(i.name)} ${i.variant ? `(${h(i.variant)})` : ''} x${i.qty}</li>`).join('')}</ul>
      <p>Thu hộ (COD): <b>${o.paymentMethod === 'COD' ? vnd(o.total) : 0}đ</b></p></body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3.5">
        <Link href="/seller/orders" className="btn-ghost py-2">‹ Đơn hàng</Link>
        <h1 className="text-xl font-bold">Đơn {o.code}</h1>
        <b className={ORDER_STATUS[o.status].color}>{ORDER_STATUS[o.status].seller}</b>
      </div>
      <div className="card p-5"><Steps steps={ORDER_STEPS} current={stepIndex(o.status)} cancelled={o.status === 'CANCELLED'} /></div>
      <div className="flex flex-wrap gap-3">
        <div className="card flex flex-1 basis-72 flex-col gap-2 p-5 text-sm">
          <b className="text-[15px]">Người nhận</b>
          <span>{o.shipName} · {o.shipPhone}</span>
          <span className="text-[13px] leading-relaxed text-muted">{o.shipAddress}</span>
          <span className="text-[13px] text-muted">Thanh toán: {o.paymentMethod === 'COD' ? 'Khi nhận hàng' : 'VNPay'} {o.paymentStatus === 'PAID' && '(đã thanh toán)'}</span>
          <span className="text-[13px] text-muted">Vận chuyển: {o.shippingService}</span>
          {o.ghnOrderCode && <span className="text-[13px]">Mã vận đơn GHN: <b>{o.ghnOrderCode}</b>{o.expectedDelivery && ` · dự kiến ${dateTime(o.expectedDelivery)}`}</span>}
          {o.note && <span className="text-[13px]">Lời nhắn: {o.note}</span>}
        </div>
        <div className="card flex flex-1 basis-72 flex-col gap-2.5 p-5 text-sm">
          <b className="text-[15px]">Thanh toán</b>
          <div className="flex justify-between"><span className="text-muted">Tiền hàng</span><span>{vnd(o.subtotal)}đ</span></div>
          <div className="flex justify-between"><span className="text-muted">Phí sàn (7%)</span><span>-{vnd(o.platformFee)}đ</span></div>
          {o.discount > 0 && <div className="flex justify-between"><span className="text-muted">Voucher</span><span>-{vnd(o.discount)}đ</span></div>}
          <div className="flex items-baseline justify-between border-t border-line pt-2.5"><b>Bạn nhận</b><b className="text-xl text-ok">{vnd(o.net)}đ</b></div>
        </div>
      </div>
      <div className="card flex flex-col gap-3 p-5">
        {o.items.map((i) => (
          <div key={i.id} className="flex items-center gap-3.5">
            <ProductImage src={i.image} alt={i.name} className="h-14 w-14 rounded-md" />
            <span className="flex-1 text-sm">{i.name}{i.variant && <span className="block text-xs text-muted">{i.variant}</span>}</span>
            <span className="text-[13px] text-muted">x{i.qty}</span>
            <b className="text-sm">{vnd(i.price * i.qty)}đ</b>
          </div>
        ))}
      </div>
      {o.returnRequest && (
        <div className="card flex flex-col gap-2 border border-gold p-5 text-sm">
          <b>Yêu cầu trả hàng {o.returnRequest.code} · {o.returnRequest.status === 'PENDING' ? 'Đang chờ' : o.returnRequest.status === 'REFUNDED' ? 'Đã hoàn tiền' : 'Đã từ chối'}</b>
          <span>Lý do: {o.returnRequest.reason}</span>
          {o.returnRequest.description && <span className="text-muted">{o.returnRequest.description}</span>}
          {o.returnRequest.status === 'PENDING' && (
            <div className="flex gap-2"><button onClick={() => run(`returns/${o.returnRequest!.id}/accept`, undefined, 'Đã chấp nhận hoàn tiền')} className="btn-primary">Đồng ý hoàn tiền</button>
              <span className="self-center text-xs text-muted">Không đồng ý? Giá Tốt sẽ phân xử khiếu nại.</span></div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2.5">
        {a && <button onClick={() => run(`orders/${o.id}/${a[0]}`)} className="btn-primary px-6 py-3">{a[1]}</button>}
        {['PENDING', 'CONFIRMED'].includes(o.status) && (
          <button onClick={() => { const r = prompt('Lý do hủy đơn', 'Hết hàng'); if (r) run(`orders/${o.id}/cancel`, { reason: r }, 'Đã hủy đơn'); }} className="btn-danger px-5 py-3">Hủy đơn</button>
        )}
        {o.ghnOrderCode && <button onClick={printSlip} className="btn-ghost px-5 py-3">In phiếu giao hàng</button>}
      </div>
    </>
  );
}
