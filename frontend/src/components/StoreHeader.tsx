'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/app-context';
import { Logo } from './ui';

const TRENDING = ['tai nghe', 'áo thun', 'sneaker', 'serum', 'bình giữ nhiệt'];
const HIST_KEY = 'gt_search_history';

function readHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeHistory(h: string[]) {
  try {
    localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 6)));
  } catch {
    /* bỏ qua */
  }
}

const NAV = [
  ['/', 'Trang chủ'],
  ['/search', 'Tìm kiếm'],
  ['/orders', 'Đơn mua'],
  ['/vouchers', 'Voucher & Xu'],
  ['/wishlist', 'Yêu thích'],
  ['/notifications', 'Thông báo'],
  ['/account', 'Tài khoản'],
] as const;

export function StoreHeader() {
  const { user, cartCount, logout } = useApp();
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const [hist, setHist] = useState<string[]>([]);
  const [menu, setMenu] = useState(false);

  useEffect(() => setHist(readHistory()), []);
  useEffect(() => {
    if (path === '/search') setQ(new URLSearchParams(location.search).get('q') ?? '');
    setMenu(false);
  }, [path]);

  const go = (term: string) => {
    const t = term.trim();
    if (t) {
      const h = [t, ...hist.filter((x) => x !== t)];
      setHist(h);
      writeHistory(h);
    }
    setQ(t);
    setFocus(false);
    router.push(t ? `/search?q=${encodeURIComponent(t)}` : '/search');
  };

  return (
    <div className="sticky top-0 z-30 bg-brand text-white">
      <div className="mx-auto flex max-w-site flex-wrap justify-between gap-3 px-4 py-1.5 text-xs">
        <span className="flex gap-4">
          <Link href={user?.shop ? '/seller' : '/seller/register'} className="hover:underline">Kênh người bán</Link>
          {user?.role === 'ADMIN' && <Link href="/admin" className="hover:underline">Trang quản trị</Link>}
          <span className="hidden sm:inline">Mua đúng giá · Sắm thật vui</span>
        </span>
        <span className="relative flex gap-4">
          {user ? (
            <>
              <button onClick={() => setMenu((m) => !m)} className="hover:underline">Xin chào, {user.name}</button>
              {menu && (
                <div className="absolute right-0 top-6 z-40 flex w-48 flex-col rounded-lg bg-white py-2 text-sm text-ink shadow-xl">
                  <Link href="/account" className="px-4 py-2 hover:bg-canvas">Tài khoản của tôi</Link>
                  <Link href="/orders" className="px-4 py-2 hover:bg-canvas">Đơn mua</Link>
                  {user.shop && <Link href="/seller" className="px-4 py-2 hover:bg-canvas">Kênh người bán</Link>}
                  <button onClick={() => { logout(); router.push('/'); }} className="px-4 py-2 text-left hover:bg-canvas">Đăng xuất</button>
                </div>
              )}
            </>
          ) : (
            <>
              <Link href="/register" className="hover:underline">Đăng ký</Link>
              <Link href="/login" className="hover:underline">Đăng nhập</Link>
            </>
          )}
        </span>
      </div>
      <header className="mx-auto flex max-w-site flex-wrap items-center gap-x-6 gap-y-3 px-4 pb-3 pt-1">
        <Link href="/" aria-label="Giá Tốt - Trang chủ"><Logo dark /></Link>
        <form
          className="relative flex min-w-[240px] flex-1 rounded-md bg-white p-1"
          onSubmit={(e) => { e.preventDefault(); go(q); }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            placeholder="Tìm sản phẩm, thương hiệu, cửa hàng"
            className="min-w-0 flex-1 border-0 px-3 text-sm text-ink outline-none"
            aria-label="Tìm kiếm"
          />
          <button className="rounded bg-gold px-6 py-2.5 text-sm font-semibold text-ink hover:brightness-95">Tìm</button>
          {focus && (
            <div className="absolute left-0 right-0 top-full z-40 mt-1.5 flex flex-col rounded-lg bg-white py-3 text-ink shadow-xl">
              {hist.length > 0 && <div className="px-4 py-1 text-xs font-semibold text-muted">LỊCH SỬ TÌM KIẾM</div>}
              {hist.map((h) => (
                <div key={h} className="flex items-center justify-between px-4 py-2 text-sm hover:bg-canvas">
                  <button type="button" onMouseDown={() => go(h)} className="flex-1 text-left">{h}</button>
                  <button type="button" aria-label={`Xóa ${h}`} onMouseDown={(e) => { e.preventDefault(); const n = hist.filter((x) => x !== h); setHist(n); writeHistory(n); }} className="px-1 text-muted">✕</button>
                </div>
              ))}
              <div className="px-4 pb-1 pt-2.5 text-xs font-semibold text-muted">GỢI Ý CHO BẠN</div>
              <div className="flex flex-wrap gap-2 px-4 py-1.5">
                {TRENDING.map((t) => (
                  <button type="button" key={t} onMouseDown={() => go(t)} className="rounded-full bg-brand-soft px-3 py-1.5 text-[13px] text-brand">{t}</button>
                ))}
              </div>
            </div>
          )}
        </form>
        <Link href="/cart" className="relative flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium hover:bg-white/15" aria-label="Giỏ hàng">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" /><circle cx="10" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /></svg>
          {cartCount > 0 && <span className="absolute -right-0.5 top-0 min-w-5 rounded-full bg-gold px-1.5 text-center text-[11px] font-bold leading-5 text-ink">{cartCount}</span>}
        </Link>
      </header>
      <nav className="mx-auto flex max-w-site gap-1 overflow-x-auto px-4 pb-2">
        {NAV.map(([href, label]) => (
          <Link key={href} href={href}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium ${path === href ? 'bg-white/20' : 'hover:bg-white/10'}`}>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function StoreFooter() {
  return (
    <footer className="mt-6 border-t border-line bg-white px-6 pb-6 pt-10">
      <div className="mx-auto grid max-w-site gap-7" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
        <div className="flex flex-col gap-2.5">
          <Logo size="sm" />
          <p className="text-[13px] leading-relaxed text-muted">Sàn mua sắm trực tuyến kết nối người bán và người mua trên toàn quốc. Mua đúng giá · Sắm thật vui.</p>
        </div>
        <div className="flex flex-col gap-2.5 text-[13px]">
          <b className="text-xs tracking-wide text-muted">CHĂM SÓC KHÁCH HÀNG</b>
          <Link href="/orders" className="text-brand hover:underline">Theo dõi đơn hàng</Link>
          <Link href="/orders" className="text-brand hover:underline">Trả hàng và hoàn tiền</Link>
          <Link href="/vouchers" className="text-brand hover:underline">Voucher & Xu</Link>
        </div>
        <div className="flex flex-col gap-2.5 text-[13px]">
          <b className="text-xs tracking-wide text-muted">VỀ GIÁ TỐT</b>
          <Link href="/seller/register" className="text-brand hover:underline">Đăng ký bán hàng</Link>
          <Link href="/seller" className="text-brand hover:underline">Kênh người bán</Link>
          <Link href="/search" className="text-brand hover:underline">Khám phá sản phẩm</Link>
        </div>
        <div className="flex flex-col gap-2.5 text-[13px]">
          <b className="text-xs tracking-wide text-muted">THANH TOÁN & VẬN CHUYỂN</b>
          <div className="flex flex-wrap gap-1.5">
            {['VNPay', 'COD', 'Giao Hàng Nhanh'].map((t) => <span key={t} className="rounded border border-line px-2 py-1 text-[11px]">{t}</span>)}
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 flex max-w-site flex-wrap justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
        <span>© 2026 Giá Tốt. Đồ án Đại học Cửu Long.</span>
        <span>Quốc gia: Việt Nam</span>
      </div>
    </footer>
  );
}
