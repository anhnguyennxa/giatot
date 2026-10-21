'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { PageTitle } from '@/components/DashboardShell';
import { Empty, Loading } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { dateTime, ORDER_STATUS, SELLER_ACTION, vnd } from '@/lib/format';
import type { Order } from '@/lib/types';

const TABS: [string, string][] = [['', 'Tất cả'], ['PENDING', 'Chờ xác nhận'], ['CONFIRMED', 'Chờ lấy hàng'], ['SHIPPING', 'Đang giao'], ['COMPLETED', 'Hoàn thành'], ['CANCELLED', 'Đã hủy']];

function SellerOrdersInner() {
  const { toast } = useApp();
  const [tab, setTab] = useState(useSearchParams().get('status') ?? '');
  const { data, reload } = useApi<{ orders: Order[]; counts: Record<string, number> }>(`/seller/orders${tab ? `?status=${tab}` : ''}`);

  const run = async (o: Order, action: string) => {
    try { await api(`/seller/orders/${o.id}/${action}`, { method: 'POST' }); toast(`${o.code} đã cập nhật`); reload(); } catch (e) { toast((e as Error).message); }
  };
  const total = data ? Object.entries(data.counts).filter(([k]) => k !== 'PENDING_PAYMENT').reduce((a, [, n]) => a + n, 0) : 0;

  return (
    <>
      <PageTitle>Đơn hàng</PageTitle>
      <div className="card flex overflow-x-auto">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 whitespace-nowrap border-b-2 px-3 py-3.5 text-sm font-medium ${tab === k ? 'border-brand text-brand' : 'border-transparent text-muted'}`}>
            {l} ({k ? data?.counts[k] ?? 0 : total})
          </button>
        ))}
      </div>
      {!data ? <Loading /> : data.orders.length === 0 ? <Empty>Không có đơn hàng</Empty> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead><tr>{['Mã đơn', 'Sản phẩm', 'Tổng tiền', 'Thanh toán', 'Trạng thái', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {data.orders.map((o) => {
                const a = SELLER_ACTION[o.status];
                return (
                  <tr key={o.id} className="hover:bg-brand-soft/40">
                    <td className="td"><Link href={`/seller/orders/${o.id}`} className="font-semibold text-brand">{o.code}</Link><div className="text-xs text-muted">{o.buyer?.name} · {dateTime(o.createdAt)}</div></td>
                    <td className="td min-w-[220px]">{o.items.map((i) => `${i.name} x${i.qty}`).join(', ')}{o.returnRequest?.status === 'PENDING' && <div className="text-xs font-semibold text-red-700">Có yêu cầu trả hàng</div>}</td>
                    <td className="td font-semibold text-brand">{vnd(o.total)}đ</td>
                    <td className="td">{o.paymentMethod}{o.paymentStatus === 'PAID' && <span className="text-ok"> ✓</span>}</td>
                    <td className={`td font-semibold ${ORDER_STATUS[o.status].color}`}>{ORDER_STATUS[o.status].seller}</td>
                    <td className="td">
                      {a ? <button onClick={() => run(o, a[0])} className="btn-primary whitespace-nowrap px-3 py-2 text-xs">{a[1]}</button>
                        : <Link href={`/seller/orders/${o.id}`} className="btn-ghost px-3 py-2 text-xs">Xem chi tiết</Link>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function SellerOrders() {
  return <Suspense fallback={<Loading />}><SellerOrdersInner /></Suspense>;
}
