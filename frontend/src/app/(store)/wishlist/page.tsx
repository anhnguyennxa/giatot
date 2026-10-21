'use client';

import Link from 'next/link';
import { Empty, Loading, ProductImage, RequireAuth } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { vnd } from '@/lib/format';
import type { ProductCard } from '@/lib/types';

function Wishlist() {
  const { toast, refreshCart } = useApp();
  const { data, loading, reload } = useApi<ProductCard[]>('/wishlist');
  if (loading && !data) return <Loading />;
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-bold">Yêu thích ({data?.length ?? 0})</h1>
      {!data?.length ? <Empty action={<Link href="/search" className="btn-primary">Khám phá sản phẩm</Link>}>Bạn chưa thích sản phẩm nào</Empty> : (
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
          {data.map((p) => (
            <div key={p.id} className="card flex flex-col overflow-hidden">
              <Link href={`/product/${p.id}`}><ProductImage src={p.images[0]} alt={p.name} className="aspect-square w-full" /></Link>
              <div className="flex flex-col gap-2 p-3">
                <span className="line-clamp-2 h-9 text-[13px]">{p.name}</span>
                <b className="text-brand">{vnd(p.price)}đ</b>
                <div className="flex gap-1.5">
                  <button onClick={async () => { try { await api('/cart', { body: { productId: p.id, qty: 1 } }); refreshCart(); toast('Đã thêm vào giỏ hàng'); } catch (e) { toast((e as Error).message); } }} className="btn-primary flex-1 py-2 text-xs">Thêm giỏ</button>
                  <button onClick={async () => { await api(`/wishlist/${p.id}`, { method: 'POST' }); reload(); }} className="btn-ghost py-2 text-xs">Bỏ thích</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WishlistPage() {
  return <RequireAuth><Wishlist /></RequireAuth>;
}
