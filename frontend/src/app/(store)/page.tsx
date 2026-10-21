'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Countdown, ErrorBox, Loading, ProductGrid, ProductImage } from '@/components/ui';
import { useApi } from '@/lib/api';
import { discountPct, initials, vnd } from '@/lib/format';
import type { Banner, Category, ProductCard, Shop } from '@/lib/types';

interface Home {
  banners: Banner[];
  categories: Category[];
  flash: ProductCard[];
  flashEndsAt: string;
  malls: Shop[];
  suggestions: ProductCard[];
}

const BANNER_BG = [
  'bg-[linear-gradient(120deg,#D9480F,#F07A3C)] text-white',
  'bg-[linear-gradient(120deg,#FFC233,#FFD970)] text-ink',
  'bg-[linear-gradient(120deg,#1F1A17,#4A423D)] text-white',
];
const MALL_PAL = [['#FDEDE4', '#B23A0B'], ['#FFF3D1', '#8A6100'], ['#E7F5EC', '#15803D'], ['#EDE9F7', '#4B3A9C'], ['#E6F0FB', '#1F4E9C'], ['#F7E8F1', '#9A2F6B'], ['#F3EBE0', '#6B4524'], ['#E2F3F1', '#0F6B62']];
const SORTS = ['Phổ biến', 'Mới nhất', 'Giá thấp', 'Giá cao'];

export default function HomePage() {
  const { data, error, loading } = useApi<Home>('/home');
  const [sort, setSort] = useState(0);

  const suggestions = useMemo(() => {
    const list = [...(data?.suggestions ?? [])];
    if (sort === 1) list.sort((a, b) => b.id - a.id);
    if (sort === 2) list.sort((a, b) => a.price - b.price);
    if (sort === 3) list.sort((a, b) => b.price - a.price);
    return list;
  }, [data, sort]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={`Không tải được trang chủ: ${error}. Kiểm tra backend đã chạy chưa.`} />;

  const [main, ...side] = data.banners;

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-2 md:grid-cols-[2fr_1fr]">
        {main && (
          <Link href={main.link || '/search'} className={`flex h-56 flex-col justify-end rounded-lg p-6 ${BANNER_BG[0]}`}>
            <span className="text-sm opacity-90">{main.subtitle}</span>
            <b className="mt-1 text-3xl font-extrabold">{main.title}</b>
          </Link>
        )}
        <div className="grid gap-2">
          {side.slice(0, 2).map((b, i) => (
            <Link key={b.id} href={b.link || '/search'} className={`flex flex-col justify-end rounded-lg p-4 ${BANNER_BG[i + 1]}`}>
              <span className="text-xs opacity-80">{b.subtitle}</span>
              <b className="text-lg">{b.title}</b>
            </Link>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <div className="section-title mb-3">Danh mục</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))' }}>
          {data.categories.map((c) => (
            <Link key={c.id} href={`/category/${c.id}`} className="flex flex-col items-center gap-2 rounded-lg px-1 py-2.5 hover:bg-brand-soft">
              <div className="flex h-13 w-13 items-center justify-center rounded-full bg-brand-light font-bold text-brand" style={{ width: 52, height: 52 }}>
                {initials(c.name).slice(0, 2)}
              </div>
              <div className="text-center text-xs">{c.name}</div>
            </Link>
          ))}
        </div>
      </section>

      {data.flash.length > 0 && (
        <section className="card p-4">
          <div className="mb-3.5 flex flex-wrap items-center gap-3.5">
            <b className="text-lg font-extrabold text-brand">⚡ FLASH SALE</b>
            <Countdown to={data.flashEndsAt} />
            <Link href="/search?sort=bestseller" className="ml-auto text-sm text-brand">Xem tất cả ›</Link>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' }}>
            {data.flash.map((p) => {
              const soldPct = Math.min(95, Math.round((p.sold / (p.sold + p.stock + 1)) * 100));
              return (
                <Link key={p.id} href={`/product/${p.id}`} className="flex flex-col gap-1.5">
                  <div className="relative aspect-square overflow-hidden rounded-md">
                    <ProductImage src={p.images[0]} alt={p.name} className="h-full w-full" />
                    <span className="absolute right-0 top-0 rounded-bl-md bg-gold-light px-1.5 py-0.5 text-xs font-semibold text-brand-dark">-{discountPct(p.price, p.originalPrice)}%</span>
                  </div>
                  <div className="font-semibold text-brand">{vnd(p.price)}đ</div>
                  <div className="relative h-4 overflow-hidden rounded-full bg-brand-light">
                    <div className="h-full bg-brand" style={{ width: `${soldPct}%` }} />
                    <span className="absolute inset-0 text-center text-[10px] font-semibold leading-4 text-white mix-blend-normal [text-shadow:0_0_2px_rgba(0,0,0,.4)]">Đã bán {p.sold}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {data.malls.length > 0 && (
        <section className="card p-4">
          <div className="mb-3.5 flex flex-wrap items-center gap-3">
            <b className="text-lg font-extrabold text-brand">GIÁ TỐT MALL</b>
            <span className="flex flex-wrap gap-3.5 text-xs text-muted"><span>✓ Chính hãng 100%</span><span>✓ Đổi trả 15 ngày</span><span>✓ Giao nhanh</span></span>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
            <div className="flex min-h-48 flex-col justify-end rounded-lg bg-[linear-gradient(135deg,#FDEDE4,#FFF3D1)] p-4">
              <span className="text-xs text-muted">Giá Tốt Mall</span>
              <b className="text-xl text-brand">Thương hiệu chính hãng, ưu đãi đến 40%</b>
            </div>
            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))' }}>
              {data.malls.map((m, i) => {
                const [bg, fg] = MALL_PAL[i % MALL_PAL.length];
                return (
                  <Link key={m.id} href={`/shop/${m.id}`} className="flex flex-col overflow-hidden rounded-lg border border-line hover:border-brand">
                    <div className="flex h-20 flex-col items-center justify-center gap-1.5" style={{ background: bg }}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full text-base font-bold" style={{ background: fg, color: bg }}>{m.name[0]}</div>
                      <span className="text-[9px] font-bold tracking-[2px]" style={{ color: fg }}>{m.name.toUpperCase().split(' ')[0]}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 px-2.5 py-2">
                      <span className="self-start rounded-sm bg-brand px-1.5 text-[10px] font-semibold text-white">Mall</span>
                      <span className="text-[13px] font-medium">{m.name}</span>
                      <span className="text-xs text-brand">★ {m.rating.toFixed(1)} · {m.city}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <b className="mr-2 text-[15px]">GỢI Ý HÔM NAY</b>
          {SORTS.map((l, i) => (
            <button key={l} onClick={() => setSort(i)} className={`pill ${sort === i ? 'pill-on' : 'pill-off'}`}>{l}</button>
          ))}
        </div>
        <ProductGrid items={suggestions} />
        <div className="mt-4 text-center">
          <Link href="/search" className="btn-ghost px-16">Xem thêm</Link>
        </div>
      </section>
    </div>
  );
}
