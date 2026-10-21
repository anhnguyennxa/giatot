'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/app-context';
import { discountPct, vnd } from '@/lib/format';
import type { ProductCard as Card, Role } from '@/lib/types';

/** Biểu tượng thẻ giá + dấu tích theo logo Giá Tốt. */
export function LogoMark({ size = 32, dark = false }: { size?: number; dark?: boolean }) {
  const tag = dark ? '#FFC233' : '#D9480F';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M36 4h20a4 4 0 0 1 4 4v20a4 4 0 0 1-1.2 2.8L32.6 57a4 4 0 0 1-5.6 0L7 37a4 4 0 0 1 0-5.6L33.2 5.2A4 4 0 0 1 36 4z" fill={tag} />
      <circle cx="49" cy="15" r="4.5" fill={dark ? '#1F1A17' : '#FFC233'} />
      <path d="M19 33l8 8 15-15" fill="none" stroke={dark ? '#1F1A17' : '#fff'} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ dark = false, size = 'md' }: { dark?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const text = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-2xl';
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size === 'lg' ? 40 : size === 'sm' ? 24 : 32} dark={dark} />
      <span className={`${text} font-extrabold tracking-tight`}>
        <span className={dark ? 'text-white' : 'text-ink'}>Giá </span>
        <span className={dark ? 'text-gold' : 'text-brand'}>Tốt</span>
      </span>
    </span>
  );
}

export function ProductImage({ src, alt, className = '' }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-[repeating-linear-gradient(135deg,#f1ece6_0_10px,#ebe4dc_10px_20px)] font-mono text-[11px] text-muted ${className}`}>
        ảnh sản phẩm
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
}

export function ProductCardView({ p }: { p: Card }) {
  const off = discountPct(p.price, p.originalPrice);
  return (
    <Link href={`/product/${p.id}`} className="group flex flex-col overflow-hidden rounded-lg border border-transparent bg-white transition hover:border-brand hover:shadow-[0_4px_14px_rgba(217,72,15,.15)]">
      <div className="relative aspect-square">
        <ProductImage src={p.images[0]} alt={p.name} className="h-full w-full" />
        {off > 0 && <span className="absolute right-0 top-0 rounded-bl-md bg-gold-light px-1.5 py-0.5 text-xs font-semibold text-brand-dark">-{off}%</span>}
        {p.shop.isMall && <span className="absolute left-1.5 top-1.5 rounded-sm bg-brand px-1.5 text-[10px] font-semibold text-white">Mall</span>}
        {p.stock === 0 && <span className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm font-semibold text-muted">Hết hàng</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <div className="line-clamp-2 h-9 text-[13px] leading-[18px]">{p.name}</div>
        {p.freeShip && <span className="self-start rounded-sm border border-ok px-1 text-[10px] text-ok">Miễn phí vận chuyển</span>}
        <div className="mt-auto flex items-baseline justify-between gap-1">
          <span className="text-[15px] font-semibold text-brand">{vnd(p.price)}đ</span>
          <span className="text-[11px] text-muted">Đã bán {p.sold >= 1000 ? `${(p.sold / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}k` : p.sold}</span>
        </div>
        <div className="text-[11px] text-muted">★ {p.rating.toFixed(1)} · {p.shop.city ?? 'Toàn quốc'}</div>
      </div>
    </Link>
  );
}

export function ProductGrid({ items, min = 180 }: { items: Card[]; min?: number }) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(auto-fill,minmax(${min}px,1fr))` }}>
      {items.map((p) => <ProductCardView key={p.id} p={p} />)}
    </div>
  );
}

export function Empty({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-4 p-12 text-center text-sm text-muted">
      {children}
      {action}
    </div>
  );
}

export function Loading({ label = 'Đang tải...' }: { label?: string }) {
  return <div className="p-10 text-center text-sm text-muted">{label}</div>;
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="card border border-red-200 p-6 text-sm text-red-700">{message}</div>;
}

export function Steps({ steps, current, cancelled = false }: { steps: string[]; current: number; cancelled?: boolean }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length},minmax(0,1fr))` }}>
      {steps.map((s, i) => {
        const on = !cancelled && i <= current;
        return (
          <div key={s} className="flex flex-col gap-1.5">
            <div className={`h-1 rounded ${on ? 'bg-brand' : 'bg-line'}`} />
            <span className={`text-xs ${on ? 'text-brand' : 'text-muted'} ${i === current ? 'font-semibold' : ''}`}>{s}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
  const parts = [Math.floor(left / 3600), Math.floor(left / 60) % 60, left % 60].map((n) => String(n).padStart(2, '0'));
  return (
    <div className="flex gap-1" suppressHydrationWarning>
      {parts.map((p, i) => <span key={i} className="rounded bg-ink px-1.5 py-0.5 font-mono text-sm font-semibold text-white">{p}</span>)}
    </div>
  );
}

export function Stars({ value, size = 'text-sm' }: { value: number; size?: string }) {
  return (
    <span className={`${size} text-gold`} aria-label={`${value} sao`}>
      {'★'.repeat(Math.round(value))}
      <span className="text-line">{'★'.repeat(5 - Math.round(value))}</span>
    </span>
  );
}

/** Chặn trang khi chưa đăng nhập hoặc sai vai trò. */
export function RequireAuth({ children, role }: { children: React.ReactNode; role?: Role }) {
  const { user, ready } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
  }, [ready, user, router]);
  if (!ready || !user) return <Loading />;
  if (role && user.role !== role) {
    return <Empty action={<Link href="/" className="btn-primary">Về trang chủ</Link>}>Bạn không có quyền truy cập trang này.</Empty>;
  }
  return <>{children}</>;
}

export function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={label}
      className={`relative h-6 w-11 flex-none rounded-full transition ${on ? 'bg-brand' : 'bg-line'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

export function StatusBadge({ on, onLabel, offLabel, onClick }: { on: boolean; onLabel: string; offLabel: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-24 rounded-full py-1 text-xs font-semibold ${on ? 'bg-ok-light text-ok' : 'bg-canvas text-muted'}`}>
      {on ? onLabel : offLabel}
    </button>
  );
}

export function Bars({ data, unit = '' }: { data: { label: string; value: number }[]; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-44 items-end gap-2.5">
      {data.map((d) => (
        <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-[11px] text-muted">{d.value ? `${(d.value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}${unit}` : '0'}</span>
          <div className="w-full rounded-t bg-brand" style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} />
          <span className="text-[11px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Meter({ label, value, pct, color = 'bg-brand' }: { label: string; value: string; pct: number; color?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[13px]"><span>{label}</span><b>{value}</b></div>
      <div className="h-2.5 overflow-hidden rounded bg-canvas"><div className={`h-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card flex flex-col gap-1.5 p-4">
      <span className="text-[13px] text-muted">{label}</span>
      <b className="text-2xl">{value}</b>
      {sub && <span className="text-xs text-ok">{sub}</span>}
    </div>
  );
}
