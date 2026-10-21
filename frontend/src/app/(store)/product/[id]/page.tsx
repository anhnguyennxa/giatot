'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Empty, Loading, ProductGrid, ProductImage, Stars } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { date, discountPct, initials, vnd } from '@/lib/format';
import type { ProductCard } from '@/lib/types';

interface Detail {
  id: number;
  name: string;
  description: string;
  price: number;
  originalPrice: number | null;
  stock: number;
  sold: number;
  rating: number;
  ratingCount: number;
  images: string[];
  options: { name: string; values: string[] }[] | null;
  freeShip: boolean;
  category: { id: number; name: string; parent: { id: number; name: string } | null };
  brand: { id: number; name: string } | null;
  shop: { id: number; name: string; city: string | null; isMall: boolean; rating: number; followers: number; createdAt: string; _count: { products: number } };
  reviews: { id: number; rating: number; content: string; tags: string[]; createdAt: string; user: { name: string } }[];
  related: ProductCard[];
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, toast, refreshCart } = useApp();
  const { data: p, error, loading } = useApi<Detail>(`/products/${id}`);
  const [img, setImg] = useState(0);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setImg(0);
    setQty(1);
    setSel(Object.fromEntries((p?.options ?? []).map((o) => [o.name, o.values[0]])));
  }, [p]);

  useEffect(() => {
    if (!user || !p) return;
    api<ProductCard[]>('/wishlist').then((w) => setLiked(w.some((x) => x.id === p.id))).catch(() => undefined);
  }, [user, p]);

  if (loading) return <Loading />;
  if (error || !p) return <Empty action={<Link href="/" className="btn-primary">Về trang chủ</Link>}>{error ?? 'Không tìm thấy sản phẩm'}</Empty>;

  const variant = Object.entries(sel).map(([k, v]) => `${k}: ${v}`).join(', ');
  const requireLogin = () => {
    if (!user) router.push(`/login?next=/product/${p.id}`);
    return !!user;
  };

  const addToCart = async (buyNow = false) => {
    if (!requireLogin()) return;
    setBusy(true);
    try {
      const item = await api<{ id: number }>('/cart', { body: { productId: p.id, qty, variant } });
      await refreshCart();
      if (buyNow) {
        await api('/cart/select-all', { body: { selected: false } });
        await api(`/cart/${item.id}`, { method: 'PATCH', body: { selected: true } });
        router.push('/checkout');
      } else toast('Đã thêm vào giỏ hàng');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleWish = async () => {
    if (!requireLogin()) return;
    const r = await api<{ liked: boolean }>(`/wishlist/${p.id}`, { method: 'POST' });
    setLiked(r.liked);
    toast(r.liked ? 'Đã thêm vào Yêu thích' : 'Đã bỏ thích');
  };

  const off = discountPct(p.price, p.originalPrice);
  const root = p.category.parent ?? p.category;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[13px] text-muted">
        <Link href="/" className="hover:text-brand">Trang chủ</Link> › <Link href={`/category/${root.id}`} className="hover:text-brand">{root.name}</Link>
        {p.category.parent && <> › {p.category.name}</>} › {p.name}
      </div>
      <div className="card flex flex-wrap gap-7 p-5">
        <div className="flex max-w-[440px] flex-1 basis-80 flex-col gap-2.5">
          <ProductImage src={p.images[img]} alt={p.name} className="aspect-square w-full rounded-lg" />
          <div className="grid grid-cols-5 gap-2">
            {p.images.map((src, i) => (
              <button key={i} onClick={() => setImg(i)} className={`overflow-hidden rounded-md border-2 ${i === img ? 'border-brand' : 'border-transparent'}`}>
                <ProductImage src={src} alt="" className="aspect-square w-full" />
              </button>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 basis-80 flex-col gap-4">
          <h1 className="text-xl font-semibold leading-snug">{p.shop.isMall && <span className="mr-2 rounded-sm bg-brand px-1.5 py-0.5 align-middle text-xs text-white">Mall</span>}{p.name}</h1>
          <div className="flex flex-wrap gap-4 text-[13px] text-muted">
            <span><b className="text-brand">{p.rating.toFixed(1)}</b> <Stars value={p.rating} /></span>
            <span>{vnd(p.ratingCount)} đánh giá</span>
            <span>Đã bán {vnd(p.sold)}</span>
            {p.brand && <span>Thương hiệu: <b className="text-ink">{p.brand.name}</b></span>}
          </div>
          <div className="flex items-baseline gap-3 rounded-lg bg-canvas p-4">
            <b className="text-3xl text-brand">{vnd(p.price)}đ</b>
            {off > 0 && <>
              <span className="text-sm text-muted line-through">{vnd(p.originalPrice)}đ</span>
              <span className="rounded bg-gold-light px-1.5 py-0.5 text-xs font-semibold text-brand-dark">-{off}%</span>
            </>}
          </div>
          {(p.options ?? []).map((o) => (
            <div key={o.name} className="flex flex-wrap items-center gap-3">
              <span className="w-24 text-[13px] text-muted">{o.name}</span>
              {o.values.map((v) => (
                <button key={v} onClick={() => setSel({ ...sel, [o.name]: v })} className={`chip rounded-md ${sel[o.name] === v ? 'chip-on' : 'chip-off'}`}>{v}</button>
              ))}
            </div>
          ))}
          <div className="flex items-center gap-3">
            <span className="w-24 text-[13px] text-muted">Số lượng</span>
            <div className="flex overflow-hidden rounded-md border border-line">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="h-9 w-9 bg-white text-base" aria-label="Giảm">−</button>
              <span className="w-11 border-x border-line text-center text-sm leading-9">{qty}</span>
              <button onClick={() => setQty(Math.min(p.stock || 1, qty + 1))} className="h-9 w-9 bg-white text-base" aria-label="Tăng">+</button>
            </div>
            <span className="text-xs text-muted">{p.stock > 0 ? `Còn ${p.stock} sản phẩm` : 'Hết hàng'}</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button disabled={busy || p.stock === 0} onClick={() => addToCart(false)} className="btn-outline px-6 py-3">Thêm vào giỏ hàng</button>
            <button disabled={busy || p.stock === 0} onClick={() => addToCart(true)} className="btn-primary px-8 py-3">Mua ngay</button>
            <button onClick={toggleWish} className="btn-ghost px-5 py-3">{liked ? '♥ Đã thích' : '♡ Yêu thích'}</button>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted">
            <span>✓ Đổi trả 15 ngày</span><span>✓ Chính hãng 100%</span>
            <span>✓ {p.freeShip ? 'Miễn phí vận chuyển từ 150.000đ' : 'Giao hàng nhanh GHN'}</span>
          </div>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light font-bold text-brand">{initials(p.shop.name)}</div>
        <div className="flex flex-col gap-0.5">
          <b>{p.shop.name}</b>
          <span className="text-xs text-muted">{p.shop.city} · ★ {p.shop.rating.toFixed(1)} · {vnd(p.shop.followers)} người theo dõi · {p.shop._count.products} sản phẩm</span>
        </div>
        <Link href={`/shop/${p.shop.id}`} className="btn-outline ml-auto">Xem cửa hàng</Link>
      </div>

      <div className="card flex flex-col gap-2.5 p-5">
        <b>MÔ TẢ SẢN PHẨM</b>
        <p className="max-w-3xl whitespace-pre-line text-sm leading-7 text-ink-soft">{p.description || 'Người bán chưa thêm mô tả.'}</p>
      </div>

      <div className="card flex flex-col gap-4 p-5">
        <b>ĐÁNH GIÁ SẢN PHẨM ({p.ratingCount})</b>
        {p.reviews.length === 0 && <span className="text-sm text-muted">Chưa có đánh giá chi tiết.</span>}
        {p.reviews.map((r) => (
          <div key={r.id} className="flex gap-3 border-t border-line pt-3.5">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-light text-[13px] font-semibold text-brand">{initials(r.user.name)}</div>
            <div className="flex flex-col gap-1">
              <b className="text-[13px]">{r.user.name}</b>
              <Stars value={r.rating} size="text-xs" />
              {r.tags.length > 0 && <div className="flex flex-wrap gap-1">{r.tags.map((t) => <span key={t} className="rounded bg-canvas px-2 py-0.5 text-[11px]">{t}</span>)}</div>}
              <span className="text-sm leading-relaxed">{r.content}</span>
              <span className="text-[11px] text-muted">{date(r.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>

      {p.related.length > 0 && (
        <section>
          <b className="mb-3 block text-[15px]">SẢN PHẨM TƯƠNG TỰ</b>
          <ProductGrid items={p.related} min={170} />
        </section>
      )}
    </div>
  );
}
