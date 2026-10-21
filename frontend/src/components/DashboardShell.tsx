'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/lib/app-context';
import { initials } from '@/lib/format';
import { Logo } from './ui';

export interface NavItem {
  href: string;
  label: string;
  badge?: number;
}

export function DashboardShell({ variant, title, nav, children }: { variant: 'seller' | 'admin'; title: string; nav: NavItem[]; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, logout } = useApp();
  const dark = variant === 'admin';
  const active = (href: string) => (href === `/${variant}` ? path === href : path.startsWith(href));

  return (
    <div className="flex min-h-screen flex-col">
      <header className={`sticky top-0 z-20 flex items-center gap-3.5 border-b px-6 py-3 ${dark ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}>
        <Link href="/"><Logo dark={dark} size="sm" /></Link>
        <span className={`rounded px-2.5 py-0.5 text-[13px] font-semibold ${dark ? 'bg-brand text-white' : 'text-muted'}`}>{title}</span>
        <div className="ml-auto flex items-center gap-2.5">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${dark ? 'bg-gold text-ink' : 'bg-brand-light text-brand'}`}>{initials(user?.shop?.name ?? user?.name ?? '?')}</div>
          <span className="hidden text-[13px] sm:inline">{variant === 'seller' ? user?.shop?.name ?? user?.name : user?.name}</span>
          <button onClick={() => { logout(); router.push('/'); }} className={`ml-2 text-xs ${dark ? 'text-white/70 hover:text-white' : 'text-muted hover:text-ink'}`}>Đăng xuất</button>
        </div>
      </header>
      <div className="flex flex-1 flex-wrap items-start">
        <aside className="sticky top-[57px] flex w-full flex-row gap-0.5 overflow-x-auto border-r border-line bg-white px-2.5 py-3.5 md:w-60 md:flex-col">
          {nav.map((n) => (
            <Link key={n.href} href={n.href}
              className={`flex items-center justify-between whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium ${active(n.href) ? 'bg-brand-light text-brand' : 'hover:bg-canvas'}`}>
              <span>{n.label}</span>
              {!!n.badge && <span className="ml-2 rounded-full bg-brand px-2 text-[11px] leading-[18px] text-white">{n.badge}</span>}
            </Link>
          ))}
        </aside>
        <main className="flex min-w-0 flex-1 basis-[560px] flex-col gap-4 p-6">{children}</main>
      </div>
      <footer className="flex flex-wrap justify-between gap-3 border-t border-line bg-white px-6 py-4 text-xs text-muted">
        <span>© 2026 Giá Tốt · {title}</span>
        <Link href="/" className="text-brand">Về trang chủ</Link>
      </footer>
    </div>
  );
}

export function PageTitle({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="flex-1 text-xl font-bold">{children}</h1>
      {actions}
    </div>
  );
}
