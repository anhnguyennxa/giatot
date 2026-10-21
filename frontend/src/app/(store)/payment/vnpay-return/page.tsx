'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { vnd } from '@/lib/format';

const CODES: Record<string, string> = {
  '24': 'Bạn đã hủy giao dịch',
  '11': 'Hết hạn chờ thanh toán',
  '51': 'Tài khoản không đủ số dư',
  '12': 'Thẻ/Tài khoản bị khóa',
  '13': 'Sai mật khẩu OTP',
  '65': 'Vượt quá hạn mức giao dịch trong ngày',
  '75': 'Ngân hàng đang bảo trì',
};

function ReturnInner() {
  const [state, setState] = useState<{ ok: boolean; message: string; amount: number; orders: string[] } | null>(null);

  useEffect(() => {
    const qs = window.location.search;
    const params = new URLSearchParams(qs);
    api<{ RspCode: string; Message: string; success?: boolean; orders?: string[] }>(`/payments/vnpay/return${qs}`)
      .then((r) => {
        const ok = !!r.success;
        const code = params.get('vnp_ResponseCode') ?? '';
        setState({
          ok,
          message: r.RspCode === '97' ? 'Chữ ký không hợp lệ' : ok ? 'Thanh toán thành công' : CODES[code] || 'Thanh toán không thành công',
          amount: Number(params.get('vnp_Amount') ?? 0) / 100,
          orders: r.orders ?? [],
        });
      })
      .catch((e) => setState({ ok: false, message: (e as Error).message, amount: 0, orders: [] }));
  }, []);

  if (!state) return <Loading label="Đang xác nhận kết quả thanh toán..." />;
  return (
    <div className="card mx-auto flex max-w-lg flex-col items-center gap-4 p-10 text-center">
      <div className={`flex h-16 w-16 items-center justify-center rounded-full text-3xl ${state.ok ? 'bg-ok-light text-ok' : 'bg-brand-light text-brand'}`}>{state.ok ? '✓' : '!'}</div>
      <h1 className="text-xl font-bold">{state.message}</h1>
      {state.amount > 0 && <p className="text-sm text-muted">Số tiền: <b className="text-ink">{vnd(state.amount)}đ</b> qua VNPay</p>}
      {state.orders.length > 0 && <p className="text-sm text-muted">Đơn hàng: {state.orders.join(', ')}</p>}
      {!state.ok && <p className="text-[13px] text-muted">Đơn hàng vẫn được giữ ở mục “Chờ thanh toán”, bạn có thể thanh toán lại.</p>}
      <div className="flex gap-2">
        <Link href="/orders" className="btn-primary">Xem đơn mua</Link>
        <Link href="/" className="btn-ghost">Tiếp tục mua sắm</Link>
      </div>
    </div>
  );
}

export default function VnpayReturnPage() {
  return <Suspense fallback={<Loading />}><ReturnInner /></Suspense>;
}
