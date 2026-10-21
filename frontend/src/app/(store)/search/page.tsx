'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Pager } from '@/components/Pager';
import { Empty, Loading, ProductGrid } from '@/components/ui';
import { useApi } from '@/lib/api';
import { vnd } from '@/lib/format';
import type { ProductCard } from '@/lib/types';

const SORTS = [['', 'Phổ biến'], ['newest', 'Mới nhất'], ['bestseller', 'Bán chạy'], ['price_asc', 'Giá thấp'], ['price_desc', 'Giá cao']] as const;
const RATINGS = [[0, 'Tất cả'], [4, 'Từ 4 sao'], [4.5, 'Từ 4.5 sao']] as const;

function SearchInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const q = sp.get('q') ?? '';
  const sort = sp.get('sort') ?? '';
  const [maxPrice, setMaxPrice] = useState(Number(sp.get('maxPrice')) || 2000000);
  const minRating = Number(sp.get('minRating')) || 0;
  const freeShip = sp.get('freeShip') === 'true';
  const page = Number(sp.get('page')) || 1;

  const update = (patch: Record<string, string | number | boolean | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '' || v === false || v === 0) next.delete(k);
      else next.set(k, String(v));
    }
    if (!('page' in patch)) next.delete('page');
    router.push(`/search?${next.toString()}`);
  };

  // Kéo thanh giá xong mới gọi API.
  useEffect(() => {
    const t = setTimeout(() => {
      if (maxPrice !== (Number(sp.get('maxPrice')) || 2000000)) update({ maxPrice: maxPrice >= 2000000 ? null : maxPrice });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxPrice]);

  const params = new URLSearchParams(sp.toString());
  params.set('limit', '20');
  const { data, loading } = useApi<{ items: ProductCard[]; total: number; page: number; pages: number }>(`/products?${params.toString()}`);

  return (
    <div className="flex flex-wrap items-start gap-4">
      <aside className="card flex w-full flex-col gap-5 p-4 md:w-56">
        <b className="text-sm">BỘ LỌC</b>
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Giá tối đa: {maxPrice >= 2000000 ? 'Không giới hạn' : `${vnd(maxPrice)}đ`}</span>
          <input type="range" min={50000} max={2000000} step={50000} value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} className="accent-brand" />
        </label>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Đánh giá</span>
          {RATINGS.map(([r, l]) => (
            <button key={r} onClick={() => update({ minRating: r })} className={`chip text-left ${minRating === r ? 'chip-on' : 'chip-off'} rounded-md`}>{l}</button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input type="checkbox" checked={freeShip} onChange={() => update({ freeShip: !freeShip })} className="accent-brand" />
          Miễn phí vận chuyển
        </label>
        <button onClick={() => { setMaxPrice(2000000); router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search'); }} className="btn-ghost">Xóa bộ lọc</button>
      </aside>
      <section className="flex min-w-0 flex-1 basis-[480px] flex-col gap-3">
        <div className="card flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-1.5 text-[13px] text-muted">Sắp xếp</span>
          {SORTS.map(([k, l]) => (
            <button key={k} onClick={() => update({ sort: k })} className={`pill ${sort === k ? 'pill-on' : 'pill-off'}`}>{l}</button>
          ))}
          <span className="ml-auto text-[13px] text-muted">
            {q && <>Kết quả cho “<b className="text-ink">{q}</b>”: </>}{data?.total ?? 0} sản phẩm
          </span>
        </div>
        {loading && !data ? <Loading /> : data && data.items.length ? (
          <>
            <ProductGrid items={data.items} min={170} />
            <Pager page={page} pages={data.pages} onPage={(p) => update({ page: p })} />
          </>
        ) : (
          <Empty>Không tìm thấy sản phẩm phù hợp. Hãy thử từ khóa khác hoặc nới lỏng bộ lọc.</Empty>
        )}
      </section>
    </div>
  );
}

export default function SearchPage() {
  return <Suspense fallback={<Loading />}><SearchInner /></Suspense>;
}
