'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Loading, Logo } from '@/components/ui';
import { useApp } from '@/lib/app-context';

const DEMO = [
  ['an@giatot.vn', 'Người mua'],
  ['lumen@giatot.vn', 'Người bán'],
  ['admin@giatot.vn', 'Quản trị'],
];

function LoginInner() {
  const { login } = useApp();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const u = await login(email, password);
      router.replace(next || (u.role === 'ADMIN' ? '/admin' : u.role === 'SELLER' ? '/seller' : '/'));
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 py-6">
      <div className="card flex flex-col gap-5 p-7">
        <div className="flex flex-col items-center gap-2"><Logo size="lg" /><span className="text-sm text-muted">Mua đúng giá · Sắm thật vui</span></div>
        <h1 className="text-xl font-bold">Đăng nhập</h1>
        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <label className="label">Email<input required type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <label className="label">Mật khẩu<input required type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
          {err && <p className="text-sm text-red-700">{err}</p>}
          <button disabled={busy} className="btn-primary py-3">{busy ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
        </form>
        <p className="text-center text-sm text-muted">Chưa có tài khoản? <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-brand">Đăng ký</Link></p>
      </div>
      <div className="card flex flex-col gap-2 p-4 text-[13px]">
        <b className="text-muted">Tài khoản dùng thử (dữ liệu seed)</b>
        {DEMO.map(([e, r]) => (
          <button key={e} onClick={() => setEmail(e)} className="flex justify-between rounded-md bg-canvas px-3 py-2 text-left hover:bg-brand-soft">
            <span>{e}</span><span className="text-muted">{r}</span>
          </button>
        ))}
        <span className="text-xs text-muted">Mật khẩu xem trong README (prisma/seed.ts).</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<Loading />}><LoginInner /></Suspense>;
}
