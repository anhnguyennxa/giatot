'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Loading, Logo } from '@/components/ui';
import { useApp } from '@/lib/app-context';

function RegisterInner() {
  const { register, toast } = useApp();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.password !== f.confirm) return setErr('Mật khẩu nhập lại không khớp');
    setBusy(true);
    setErr('');
    try {
      await register({ name: f.name, email: f.email, password: f.password, phone: f.phone || undefined });
      toast('Đăng ký thành công, bạn được tặng 100 xu!');
      router.replace(next || '/');
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof typeof f, label: string, type = 'text') => (
    <label className="label">{label}<input required={k !== 'phone'} type={type} className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  );

  return (
    <div className="mx-auto max-w-md py-6">
      <div className="card flex flex-col gap-5 p-7">
        <div className="flex justify-center"><Logo size="lg" /></div>
        <h1 className="text-xl font-bold">Tạo tài khoản</h1>
        <form onSubmit={submit} className="flex flex-col gap-3.5">
          {field('name', 'Họ tên')}
          {field('email', 'Email', 'email')}
          {field('phone', 'Số điện thoại (không bắt buộc)')}
          {field('password', 'Mật khẩu (tối thiểu 6 ký tự)', 'password')}
          {field('confirm', 'Nhập lại mật khẩu', 'password')}
          {err && <p className="text-sm text-red-700">{err}</p>}
          <button disabled={busy} className="btn-primary py-3">{busy ? 'Đang tạo...' : 'Đăng ký'}</button>
        </form>
        <p className="text-center text-sm text-muted">Đã có tài khoản? <Link href="/login" className="font-semibold text-brand">Đăng nhập</Link></p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense fallback={<Loading />}><RegisterInner /></Suspense>;
}
