'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Pager } from '@/components/Pager';
import { Empty, Loading, ProductGrid } from '@/components/ui';
import { useApi } from '@/lib/api';
import { initials } from '@/lib/format';
import type { Category, ProductCard } from '@/lib/types';

const SORTS = [['', 'Phổ biến'], ['newest', 'Mới nhất'], ['price_asc', 'Giá thấp'], ['price_desc', 'Giá cao']] as const;
const PRICES: [string, string, number | null, number | null][] = [
  ['all', 'Mọi mức giá', null, null], ['lt150', 'Dưới 150K', null, 149999], ['150-300', '150K - 300K', 150000, 300000], ['gt300', 'Trên 300K', 300001, null],
];
const BRAND_PAL = [['#E6F0FB', '#1F4E9C'], ['#FDEDE4', '#B4401F'], ['#EEF4E2', '#4A6B17'], ['#F3EBE0', '#6B4524'], ['#E2F3F1', '#0F6B62'], ['#ECE9F7', '#4B3A9C']];

export default function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const catId = Number(id);
  const { data: cats } = useApi<Category[]>('/categories');
  const [sub, setSub] = useState<number | null>(null);
  const [brand, setBrand] = useState<number | null>(null);
  const [sort, setSort] = useState('');
  const [price, setPrice] = useState('all');
  const [freeShip, setFreeShip] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => { setSub(null); setBrand(null); setPage(1); setSort(''); setPrice('all'); setFreeShip(false); }, [catId]);

  const cat = cats?.find((c) => c.id === catId);
  const pr = PRICES.find((p) => p[0] === price)!;
  const qs = new URLSearchParams({ categoryId: String(sub ?? catId), page: String(page), limit: '12' });
  if (brand) qs.set('brandId', String(brand));
  if (sort) qs.set('sort', sort);
  if (pr[2]) qs.set('minPrice', String(pr[2]));
  if (pr[3]) qs.set('maxPrice', String(pr[3]));
  if (freeShip) qs.set('freeShip', 'true');
  const { data, loading } = useApi<{ items: ProductCard[]; total: number; pages: number }>(`/products?${qs.toString()}`);

  if (!cats) return <Loading />;
  if (!cat) return <Empty action={<Link href="/" className="btn-primary">Về trang chủ</Link>}>Danh mục không tồn tại</Empty>;

  const reset = () => { setSub(null); setBrand(null); setPrice('all'); setFreeShip(false); setPage(1); };
  const brandName = cat.brands?.find((b) => b.id === brand)?.name;
  const subName = cat.children?.find((c) => c.id === sub)?.name;
  const anyFilter = sub || brand || freeShip || price !== 'all';

  return (
    <div className="flex flex-wrap items-start gap-4">
      <aside className="card flex w-full flex-col gap-0.5 p-2 md:w-56">
        {cats.map((c) => (
          <Link key={c.id} href={`/category/${c.id}`} className={`rounded-md p-3 text-sm font-medium ${c.id === catId ? 'bg-brand-light text-brand' : 'hover:bg-canvas'}`}>{c.name}</Link>
        ))}
      </aside>
      <section className="flex min-w-0 flex-1 basis-[440px] flex-col gap-3">
        <div className="flex h-28 items-end rounded-lg bg-[linear-gradient(120deg,#FDEDE4,#FFF3D1)] px-5 py-4">
          <b className="text-xl text-brand">{cat.name}</b>
        </div>
        <div className="text-[13px] text-muted"><Link href="/" className="hover:text-brand">Trang chủ</Link> › {cat.name}{subName && ` › ${subName}`}</div>
        {!!cat.children?.length && (
          <div className="card grid gap-3 p-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(100px,1fr))' }}>
            {cat.children.map((s) => (
              <button key={s.id} onClick={() => { setSub(sub === s.id ? null : s.id); setPage(1); }} className="flex flex-col items-center gap-1.5">
                <div className={`flex h-14 w-14 items-center justify-center rounded-full border-2 font-bold ${sub === s.id ? 'border-brand bg-brand text-white' : 'border-transparent bg-brand-light text-brand'}`}>{initials(s.name).slice(0, 2)}</div>
                <span className="text-center text-xs">{s.name}</span>
              </button>
            ))}
          </div>
        )}
        {!!cat.brands?.length && (
          <div className="card flex flex-col gap-2.5 px-4 py-3.5">
            <b className="section-title">Thương hiệu nổi bật</b>
            <div className="flex gap-2.5 overflow-x-auto">
              {cat.brands.map((b, i) => {
                const [bg, fg] = BRAND_PAL[i % BRAND_PAL.length];
                return (
                  <button key={b.id} onClick={() => { setBrand(brand === b.id ? null : b.id); setPage(1); }}
                    className="flex h-[72px] w-24 flex-none flex-col items-center justify-center gap-1 rounded-lg border-2"
                    style={{ background: bg, color: fg, borderColor: brand === b.id ? fg : 'transparent' }}>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold" style={{ background: fg, color: bg }}>{b.name[0]}</span>
                    <span className="text-[9px] font-bold tracking-[2px]">{b.name.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="card flex flex-col gap-2.5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-[13px] text-muted">Sắp xếp</span>
            {SORTS.map(([k, l]) => <button key={k} onClick={() => { setSort(k); setPage(1); }} className={`pill ${sort === k ? 'pill-on' : 'pill-off'}`}>{l}</button>)}
            <span className="ml-auto text-[13px] text-muted">{data?.total ?? 0} sản phẩm</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-[13px] text-muted">Lọc</span>
            {PRICES.map(([k, l]) => <button key={k} onClick={() => { setPrice(k); setPage(1); }} className={`pill ${price === k ? 'pill-on' : 'pill-off'}`}>{l}</button>)}
            <button onClick={() => { setFreeShip(!freeShip); setPage(1); }} className={`pill ${freeShip ? 'pill-on' : 'pill-off'}`}>Miễn phí vận chuyển</button>
          </div>
        </div>
        {anyFilter && (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-muted">Đang lọc:</span>
            {subName && <button onClick={() => setSub(null)} className="chip chip-on">{subName} ✕</button>}
            {brandName && <button onClick={() => setBrand(null)} className="chip chip-on">{brandName} ✕</button>}
            <button onClick={reset} className="text-brand">Xóa tất cả</button>
          </div>
        )}
        {loading && !data ? <Loading /> : data?.items.length ? (
          <>
            <ProductGrid items={data.items} min={170} />
            <Pager page={page} pages={data.pages} onPage={setPage} />
          </>
        ) : (
          <Empty action={<button onClick={reset} className="btn-primary">Xóa bộ lọc</button>}>Danh mục này chưa có sản phẩm phù hợp</Empty>
        )}
      </section>
    </div>
  );
}
