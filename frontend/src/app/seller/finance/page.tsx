'use client';

import { PageTitle } from '@/components/DashboardShell';
import { Loading } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { dateTime, vnd } from '@/lib/format';

interface Finance {
  balance: number;
  pendingSettlement: number;
  feeThisMonth: number;
  feeRate: number;
  transactions: { id: number; type: string; amount: number; status: string; note: string; createdAt: string }[];
}

export default function SellerFinance() {
  const { toast } = useApp();
  const { data, reload } = useApi<Finance>('/seller/finance');
  if (!data) return <Loading />;

  const withdraw = async () => {
    if (!confirm(`Rút ${vnd(data.balance)}đ về tài khoản ngân hàng?`)) return;
    try { await api('/seller/finance/withdraw', { method: 'POST' }); toast('Đã gửi yêu cầu rút tiền'); reload(); } catch (e) { toast((e as Error).message); }
  };

  return (
    <>
      <PageTitle>Tài chính và đối soát</PageTitle>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        <div className="flex flex-col gap-1.5 rounded-lg bg-brand p-5 text-white">
          <span className="text-[13px] opacity-90">Số dư có thể rút</span>
          <b className="text-2xl">{vnd(data.balance)}đ</b>
          <button disabled={data.balance <= 0} onClick={withdraw} className="mt-1.5 self-start rounded-md bg-gold px-4 py-2 text-[13px] font-semibold text-ink disabled:opacity-50">Rút tiền</button>
        </div>
        <div className="card flex flex-col gap-1.5 p-5">
          <span className="text-[13px] text-muted">Chờ đối soát</span>
          <b className="text-2xl">{vnd(data.pendingSettlement)}đ</b>
          <span className="text-xs text-muted">Về ví khi đơn giao thành công</span>
        </div>
        <div className="card flex flex-col gap-1.5 p-5">
          <span className="text-[13px] text-muted">Phí sàn tháng này</span>
          <b className="text-2xl">{vnd(data.feeThisMonth)}đ</b>
          <span className="text-xs text-muted">Phí cố định 5% + phí thanh toán 2% ({Math.round(data.feeRate * 100)}%)</span>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[620px]">
          <thead><tr>{['Ngày', 'Nội dung', 'Trạng thái', 'Số tiền'].map((h) => <th key={h} className={`th ${h === 'Số tiền' ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
          <tbody>
            {data.transactions.map((t) => (
              <tr key={t.id}>
                <td className="td text-muted">{dateTime(t.createdAt)}</td>
                <td className="td">{t.note}</td>
                <td className={`td font-semibold ${t.status === 'Đang xử lý' ? 'text-warn' : 'text-muted'}`}>{t.status}</td>
                <td className={`td text-right font-semibold ${t.amount > 0 ? 'text-ok' : ''}`}>{t.amount > 0 ? '+' : '-'}{vnd(Math.abs(t.amount))}đ</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
