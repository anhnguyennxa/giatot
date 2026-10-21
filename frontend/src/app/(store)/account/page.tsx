'use client';

import { useEffect, useState } from 'react';
import { AddressForm } from '@/components/AddressForm';
import { RequireAuth } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { initials, vnd } from '@/lib/format';
import type { Address } from '@/lib/types';

const TABS = ['Hồ sơ', 'Địa chỉ', 'Đổi mật khẩu'];

function Profile() {
  const { user, refreshUser, toast } = useApp();
  const [f, setF] = useState({ name: '', phone: '' });
  useEffect(() => { if (user) setF({ name: user.name, phone: user.phone ?? '' }); }, [user]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api('/auth/me', { method: 'PATCH', body: f }); await refreshUser(); toast('Đã lưu hồ sơ'); } catch (e2) { toast((e2 as Error).message); }
  };
  return (
    <form onSubmit={save} className="flex max-w-lg flex-col gap-3.5">
      <b className="text-lg">Hồ sơ của tôi</b>
      <label className="label">Email<input className="input bg-canvas" value={user?.email ?? ''} disabled /></label>
      <label className="label">Họ tên<input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="label">Số điện thoại<input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
      <button className="btn-primary self-start px-8">Lưu</button>
    </form>
  );
}

function Addresses() {
  const { toast } = useApp();
  const { data, reload } = useApi<Address[]>('/addresses');
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between"><b className="text-lg">Địa chỉ của tôi</b><button onClick={() => setEditing('new')} className="btn-outline py-2">+ Thêm địa chỉ</button></div>
      {editing && (
        <div className="rounded-lg border border-line p-4">
          <AddressForm initial={editing === 'new' ? undefined : editing} onSaved={() => { setEditing(null); reload(); toast('Đã lưu địa chỉ'); }} onCancel={() => setEditing(null)} />
        </div>
      )}
      {data?.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-4 py-3.5">
          <div className="flex flex-1 basis-60 flex-col gap-1">
            <b className="text-sm">{a.fullName} · {a.phone}</b>
            <span className="text-[13px] text-muted">{a.line}, {a.wardName}, {a.districtName}, {a.provinceName}</span>
          </div>
          {a.isDefault ? <span className="rounded-sm border border-brand px-1.5 py-0.5 text-[11px] text-brand">Mặc định</span>
            : <button onClick={async () => { await api(`/addresses/${a.id}/default`, { method: 'POST' }); reload(); }} className="btn-ghost py-1.5 text-xs">Đặt mặc định</button>}
          <button onClick={() => setEditing(a)} className="text-[13px] text-brand">Sửa</button>
          {!a.isDefault && <button onClick={async () => { await api(`/addresses/${a.id}`, { method: 'DELETE' }); reload(); }} className="text-[13px] text-muted">Xóa</button>}
        </div>
      ))}
    </div>
  );
}

function Password() {
  const { toast } = useApp();
  const [f, setF] = useState({ oldPassword: '', newPassword: '' });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api('/auth/password', { body: f }); setF({ oldPassword: '', newPassword: '' }); toast('Đã đổi mật khẩu'); } catch (e2) { toast((e2 as Error).message); }
  };
  return (
    <form onSubmit={save} className="flex max-w-lg flex-col gap-3.5">
      <b className="text-lg">Đổi mật khẩu</b>
      <label className="label">Mật khẩu hiện tại<input type="password" required className="input" value={f.oldPassword} onChange={(e) => setF({ ...f, oldPassword: e.target.value })} /></label>
      <label className="label">Mật khẩu mới<input type="password" required minLength={6} className="input" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} /></label>
      <button className="btn-primary self-start px-8">Cập nhật</button>
    </form>
  );
}

function Account() {
  const { user } = useApp();
  const [tab, setTab] = useState(0);
  return (
    <div className="flex flex-wrap items-start gap-4">
      <aside className="card flex w-full flex-col gap-0.5 p-3 md:w-56">
        <div className="flex items-center gap-2.5 px-2.5 pb-3.5 pt-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-light font-bold text-brand">{initials(user!.name)}</div>
          <div className="flex flex-col"><b className="text-sm">{user!.name}</b><span className="text-xs text-gold-dark">{vnd(user!.xu)} xu</span></div>
        </div>
        {TABS.map((l, i) => (
          <button key={l} onClick={() => setTab(i)} className={`rounded-md p-2.5 text-left text-sm ${tab === i ? 'bg-brand-light text-brand' : 'hover:bg-canvas'}`}>{l}</button>
        ))}
      </aside>
      <section className="card min-w-0 flex-1 basis-[420px] p-6">
        {tab === 0 && <Profile />}
        {tab === 1 && <Addresses />}
        {tab === 2 && <Password />}
      </section>
    </div>
  );
}

export default function AccountPage() {
  return <RequireAuth><Account /></RequireAuth>;
}
