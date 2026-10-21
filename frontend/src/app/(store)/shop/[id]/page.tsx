'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Pager } from '@/components/Pager';
import { Empty, Loading, ProductGrid } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { initials, vnd } from '@/lib/format';
import type { ProductCard, Shop, Voucher } from '@/lib/types';

export default function ShopPage() {
  const { id } = useParams<{ id: string }>();
  const { user, toast } = useApp();
  const { data: shop, error } = useApi<Shop & { vouchers: Voucher[]; vacationMode: boolean; _count: { products: number } }>(`/shops/${id}`);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('bestseller');
  const [follow, setFollow] = useState(false);
  const { data } = useApi<{ items: ProductCard[]; total: number; pages: number }>(`/products?shopId=${id}&page=${page}&limit=18&sort=${sort}`);

  if (error) return <Empty>{error}</Empty>;
  if (!shop) return <Loading />;

  const save = async (v: Voucher) => {
    if (!user) return toast('Đăng nhập để lưu voucher');
    await api(`/vouchers/${v.id}/save`, { method: 'POST' });
    toast(`Đã lưu voucher ${v.code}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="card overflow-hidden">
        <div className="flex h-40 items-end bg-[linear-gradient(120deg,#FDEDE4,#FFF3D1)] px-5 py-3.5 text-xs text-muted">{shop.description}</div>
        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
          <div className="-mt-14 flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white bg-brand-light text-xl font-bold text-brand">{initials(shop.name)}</div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2"><b className="text-lg">{shop.name}</b>{shop.isMall && <span className="rounded-sm bg-brand px-1.5 text-[10px] font-semibold text-white">Mall</span>}</div>
            <span className="text-xs text-muted">Đánh giá {shop.rating.toFixed(1)} · {vnd(shop.followers + (follow ? 1 : 0))} người theo dõi · {shop._count.products} sản phẩm · {shop.city}</span>
          </div>
          <button onClick={() => setFollow(!follow)} className={`ml-auto ${follow ? 'btn-outline' : 'btn-primary'}`}>{follow ? 'Đang theo dõi' : '+ Theo dõi'}</button>
        </div>
      </div>
      {shop.vacationMode && <div className="card border border-gold p-4 text-sm">Cửa hàng đang tạm nghỉ, đơn hàng sẽ được xử lý sau.</div>}
      {shop.vouchers.length > 0 && (
        <div className="flex gap-3 overflow-x-auto">
          {shop.vouchers.map((v) => (
            <div key={v.id} className="card flex min-w-[260px] overflow-hidden border border-line">
              <div className="flex w-20 flex-none flex-col items-center justify-center bg-brand-light text-brand"><b>{Math.round(v.discount / 1000)}K</b><span className="text-[10px]">Giảm</span></div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <b className="text-[13px]">{v.name}</b>
                <span className="text-xs text-muted">Đơn từ {vnd(v.minOrder)}đ</span>
                <button onClick={() => save(v)} className="self-start rounded bg-brand px-3 py-1 text-xs font-semibold text-white">Lưu</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="card flex flex-wrap items-center gap-2 px-4 py-3">
        {[['bestseller', 'Bán chạy'], ['newest', 'Mới nhất'], ['price_asc', 'Giá thấp'], ['price_desc', 'Giá cao']].map(([k, l]) => (
          <button key={k} onClick={() => { setSort(k); setPage(1); }} className={`pill ${sort === k ? 'pill-on' : 'pill-off'}`}>{l}</button>
        ))}
      </div>
      {data ? <><ProductGrid items={data.items} min={170} /><Pager page={page} pages={data.pages} onPage={setPage} /></> : <Loading />}
    </div>
  );
}
