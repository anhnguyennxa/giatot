'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AddressForm } from '@/components/AddressForm';
import { Empty, Loading, ProductImage, RequireAuth } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { vnd } from '@/lib/format';
import type { Address, Voucher } from '@/lib/types';

interface Quote {
  address: Address;
  groups: {
    shop: { id: number; name: string };
    items: { cartItemId: number; productId: number; name: string; image: string | null; price: number; qty: number; variant: string }[];
    subtotal: number; shippingFee: number; leadDays: string; discount: number; total: number;
  }[];
  voucher: { code: string; name: string } | null;
  subtotal: number; shippingFee: number; discount: number; total: number;
  ghnMock: boolean; vnpayReady: boolean;
}

function Checkout() {
  const router = useRouter();
  const { toast, refreshCart } = useApp();
  const { data: addrs, reload: reloadAddrs } = useApi<Address[]>('/addresses');
  const { data: vdata } = useApi<{ vouchers: (Voucher & { saved: boolean; usedByMe: boolean })[] }>('/vouchers');
  const [addressId, setAddressId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState('');
  const [pay, setPay] = useState<'COD' | 'VNPAY'>('COD');
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (addrs?.length && !addressId) setAddressId((addrs.find((a) => a.isDefault) ?? addrs[0]).id);
  }, [addrs, addressId]);

  const loadQuote = useCallback(async (voucherCode: string) => {
    if (!addressId) return;
    try {
      setQuote(await api<Quote>('/checkout/quote', { body: { addressId, voucherCode: voucherCode || undefined } }));
      setApplied(voucherCode);
      setErr('');
    } catch (e) {
      const m = (e as Error).message;
      if (voucherCode) { toast(m); setCode(applied); } else setErr(m);
    }
  }, [addressId, applied, toast]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadQuote(applied); }, [addressId]);

  const place = async () => {
    if (!addressId) return toast('Vui lòng thêm địa chỉ nhận hàng');
    setBusy(true);
    try {
      const r = await api<{ orders: { code: string }[]; paymentUrl: string | null }>('/checkout', {
        body: { addressId, paymentMethod: pay, voucherCode: applied || undefined, note: note || undefined },
      });
      await refreshCart();
      if (r.paymentUrl) {
        window.location.href = r.paymentUrl;
        return;
      }
      toast('Đặt hàng thành công');
      router.replace('/orders');
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };

  if (!addrs) return <Loading />;
  if (err && !quote) return <Empty action={<Link href="/cart" className="btn-primary">Về giỏ hàng</Link>}>{err}</Empty>;

  const usable = (vdata?.vouchers ?? []).filter((v) => v.saved && !v.usedByMe && v.active);

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex min-w-0 flex-1 basis-[480px] flex-col gap-3">
        <div className="card flex flex-col gap-2.5 p-4">
          <div className="flex items-center justify-between"><b>📍 Địa chỉ nhận hàng</b>{!adding && <button onClick={() => setAdding(true)} className="text-[13px] text-brand">+ Thêm địa chỉ</button>}</div>
          {addrs.map((a) => (
            <button key={a.id} onClick={() => setAddressId(a.id)}
              className={`flex flex-col gap-0.5 rounded-lg border px-3.5 py-3 text-left ${addressId === a.id ? 'border-brand bg-brand-soft' : 'border-line'}`}>
              <b className="text-sm">{a.fullName} · {a.phone} {a.isDefault && <span className="ml-1 rounded-sm border border-brand px-1 text-[10px] font-normal text-brand">Mặc định</span>}</b>
              <span className="text-[13px] text-muted">{a.line}, {a.wardName}, {a.districtName}, {a.provinceName}</span>
            </button>
          ))}
          {(adding || addrs.length === 0) && (
            <AddressForm onSaved={async (a) => { setAdding(false); await reloadAddrs(); setAddressId(a.id); }} onCancel={addrs.length ? () => setAdding(false) : undefined} />
          )}
        </div>

        {quote?.groups.map((g) => (
          <div key={g.shop.id} className="card flex flex-col gap-3 p-4">
            <b className="text-sm">{g.shop.name}</b>
            {g.items.map((i) => (
              <div key={i.cartItemId} className="flex items-center gap-3">
                <ProductImage src={i.image} alt={i.name} className="h-[52px] w-[52px] flex-none rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col"><span className="text-[13px]">{i.name}</span>{i.variant && <span className="text-xs text-muted">{i.variant}</span>}</div>
                <span className="text-[13px] text-muted">x{i.qty}</span>
                <b className="w-24 text-right text-sm">{vnd(i.price * i.qty)}đ</b>
              </div>
            ))}
            <div className="flex justify-between rounded-md bg-canvas px-3 py-2.5 text-[13px]">
              <span><b>Giao Hàng Nhanh</b> · {g.leadDays}{quote.ghnMock && <span className="text-muted"> (giả lập)</span>}</span>
              <b>{g.shippingFee ? `${vnd(g.shippingFee)}đ` : 'Miễn phí'}</b>
            </div>
          </div>
        ))}

        <div className="card flex flex-col gap-3 p-4">
          <b>🎟️ Voucher</b>
          <div className="flex gap-2">
            <input className="input" placeholder="Nhập mã voucher" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <button onClick={() => loadQuote(code.trim())} className="btn-outline">Áp dụng</button>
            {applied && <button onClick={() => { setCode(''); loadQuote(''); }} className="btn-ghost">Bỏ</button>}
          </div>
          {usable.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {usable.map((v) => (
                <button key={v.id} onClick={() => { setCode(v.code); loadQuote(v.code); }} className={`chip ${applied === v.code ? 'chip-on' : 'chip-off'}`}>{v.code} · {v.name}</button>
              ))}
            </div>
          )}
        </div>

        <div className="card flex flex-col gap-3 p-4">
          <b>💳 Phương thức thanh toán</b>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setPay('COD')} className={`chip rounded-md px-4 py-2.5 ${pay === 'COD' ? 'chip-on' : 'chip-off'}`}>Thanh toán khi nhận hàng (COD)</button>
            <button onClick={() => setPay('VNPAY')} className={`chip rounded-md px-4 py-2.5 ${pay === 'VNPAY' ? 'chip-on' : 'chip-off'}`}>VNPay (ATM / QR / Thẻ quốc tế)</button>
          </div>
          {pay === 'VNPAY' && (
            <p className="rounded-md bg-gold-light p-3 text-xs leading-relaxed text-gold-dark">
              Bạn sẽ được chuyển sang cổng VNPay Sandbox. Thẻ test: NCB · 9704198526191432198 · NGUYEN VAN A · 07/15 · OTP 123456.
              {quote && !quote.vnpayReady && ' (Máy chủ chưa cấu hình VNP_TMN_CODE/VNP_HASH_SECRET.)'}
            </p>
          )}
          <label className="label">Lời nhắn cho người bán<input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Không bắt buộc" /></label>
        </div>
      </div>

      <aside className="card sticky top-36 flex w-full flex-col gap-3 p-5 md:w-80">
        <b>Chi tiết thanh toán</b>
        {quote ? (
          <>
            <div className="flex justify-between text-sm"><span className="text-muted">Tổng tiền hàng</span><span>{vnd(quote.subtotal)}đ</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted">Phí vận chuyển</span><span>{vnd(quote.shippingFee)}đ</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted">Voucher {quote.voucher && `(${quote.voucher.code})`}</span><span className="text-ok">-{vnd(quote.discount)}đ</span></div>
            <div className="flex items-baseline justify-between border-t border-line pt-3"><b>Tổng thanh toán</b><b className="text-2xl text-brand">{vnd(quote.total)}đ</b></div>
          </>
        ) : <span className="text-sm text-muted">{addressId ? 'Đang tính...' : 'Thêm địa chỉ để tính phí giao hàng'}</span>}
        <button disabled={busy || !quote} onClick={place} className="btn-primary py-3.5 text-[15px]">{busy ? 'Đang xử lý...' : pay === 'VNPAY' ? 'THANH TOÁN VNPAY' : 'ĐẶT HÀNG'}</button>
      </aside>
    </div>
  );
}

export default function CheckoutPage() {
  return <RequireAuth><Checkout /></RequireAuth>;
}
