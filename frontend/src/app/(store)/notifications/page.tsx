'use client';

import { useState } from 'react';
import { Empty, Loading, RequireAuth } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { dateTime } from '@/lib/format';
import type { Notification } from '@/lib/types';

const TABS: [Notification['type'], string][] = [['ORDER', 'Đơn hàng'], ['PROMO', 'Khuyến mãi'], ['SYSTEM', 'Hệ thống']];
const ICON = { ORDER: '📦', PROMO: '🎁', SYSTEM: '🔔' };

function Notifications() {
  const { data, loading, reload, setData } = useApi<Notification[]>('/notifications');
  const [tab, setTab] = useState<Notification['type']>('ORDER');
  if (loading && !data) return <Loading />;
  const list = (data ?? []).filter((n) => n.type === tab);
  const read = async (n: Notification) => {
    if (n.read) return;
    setData((data ?? []).map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    await api(`/notifications/${n.id}/read`, { method: 'POST' });
  };
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Thông báo</h1>
        <button onClick={async () => { await api('/notifications/read-all', { method: 'POST' }); reload(); }} className="text-[13px] text-brand">Đánh dấu đã đọc tất cả</button>
      </div>
      <div className="card flex">
        {TABS.map(([k, l]) => {
          const unread = (data ?? []).filter((n) => n.type === k && !n.read).length;
          return (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 border-b-2 p-3.5 text-sm font-medium ${tab === k ? 'border-brand text-brand' : 'border-transparent text-muted'}`}>
              {l}{unread > 0 && <span className="ml-1.5 rounded-full bg-brand px-1.5 text-[11px] text-white">{unread}</span>}
            </button>
          );
        })}
      </div>
      {list.length === 0 ? <Empty>Không có thông báo</Empty> : (
        <div className="card overflow-hidden">
          {list.map((n) => (
            <button key={n.id} onClick={() => read(n)} className={`flex w-full gap-3 border-t border-line p-4 text-left first:border-0 ${n.read ? 'bg-white' : 'bg-brand-soft'}`}>
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-brand-light text-xl">{ICON[n.type]}</div>
              <div className="flex flex-1 flex-col gap-1">
                <b className="text-sm">{n.title}</b>
                <span className="text-[13px] leading-relaxed text-muted">{n.body}</span>
                <span className="text-[11px] text-muted">{dateTime(n.createdAt)}</span>
              </div>
              {!n.read && <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return <RequireAuth><Notifications /></RequireAuth>;
}
