'use client';

import { useState } from 'react';
import { PageTitle } from '@/components/DashboardShell';
import { Loading } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { date } from '@/lib/format';

interface UserRow {
  id: number; name: string; email: string; phone: string | null; role: 'BUYER' | 'SELLER' | 'ADMIN'; status: 'ACTIVE' | 'LOCKED';
  createdAt: string; _count: { orders: number };
}
const ROLE = { BUYER: 'Người mua', SELLER: 'Người bán', ADMIN: 'Quản trị' };

export default function AdminUsers() {
  const { toast } = useApp();
  const [q, setQ] = useState('');
  const { data, reload } = useApi<UserRow[]>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  const toggle = async (u: UserRow) => {
    try { await api(`/admin/users/${u.id}/toggle-lock`, { method: 'POST' }); toast(u.status === 'ACTIVE' ? 'Đã khóa tài khoản' : 'Đã mở khóa'); reload(); } catch (e) { toast((e as Error).message); }
  };
  return (
    <>
      <PageTitle actions={<input className="input w-64" placeholder="Tìm tên, email hoặc số điện thoại" value={q} onChange={(e) => setQ(e.target.value)} />}>Quản lý người dùng</PageTitle>
      {!data ? <Loading /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead><tr>{['Người dùng', 'Số điện thoại', 'Vai trò', 'Đơn', 'Tham gia', 'Trạng thái', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id}>
                  <td className="td"><b>{u.name}</b><div className="text-xs text-muted">{u.email}</div></td>
                  <td className="td">{u.phone ?? '—'}</td>
                  <td className="td">{ROLE[u.role]}</td>
                  <td className="td">{u._count.orders}</td>
                  <td className="td text-muted">{date(u.createdAt)}</td>
                  <td className={`td font-semibold ${u.status === 'LOCKED' ? 'text-red-700' : 'text-ok'}`}>{u.status === 'LOCKED' ? 'Đã khóa' : 'Hoạt động'}</td>
                  <td className="td">
                    {u.role !== 'ADMIN' && (
                      <button onClick={() => toggle(u)} className={`btn border bg-white px-3 py-1.5 text-xs font-medium ${u.status === 'LOCKED' ? 'border-ok text-ok' : 'border-line text-red-700'}`}>
                        {u.status === 'LOCKED' ? 'Mở khóa' : 'Khóa tài khoản'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
