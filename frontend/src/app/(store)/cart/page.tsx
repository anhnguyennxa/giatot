'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Empty, Loading, ProductImage, RequireAuth } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { vnd } from '@/lib/format';
import type { ProductCard } from '@/lib/types';

interface CartRow {
  id: number;
  qty: number;
  variant: string;
  selected: boolean;
  product: ProductCard & { visible: boolean; status: string };
}

function Cart() {
  const router = useRouter();
  const { toast, refreshCart } = useApp();
  const { data: rows, loading, reload, setData } = useApi<CartRow[]>('/cart');

  if (loading && !rows) return <Loading />;
  if (!rows?.length) return <Empty action={<Link href="/search" className="btn-primary">Mua sắm ngay</Link>}>Giỏ hàng của bạn đang trống</Empty>;

  const patch = async (r: CartRow, body: { qty?: number; selected?: boolean }) => {
    setData(rows.map((x) => (x.id === r.id ? { ...x, ...body } : x)));
    try { await api(`/cart/${r.id}`, { method: 'PATCH', body }); } catch (e) { toast((e as Error).message); reload(); }
  };
  const remove = async (r: CartRow) => {
    await api(`/cart/${r.id}`, { method: 'DELETE' });
    await reload();
    refreshCart();
  };
  const allSel = rows.every((r) => r.selected);
  const selectAll = async () => {
    setData(rows.map((r) => ({ ...r, selected: !allSel })));
    await api('/cart/select-all', { body: { selected: !allSel } });
  };

  const groups = new Map<number, CartRow[]>();
  rows.forEach((r) => groups.set(r.product.shop.id, [...(groups.get(r.product.shop.id) ?? []), r]));
  const sel = rows.filter((r) => r.selected);
  const subtotal = sel.reduce((a, r) => a + r.product.price * r.qty, 0);

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-bold">Giỏ hàng ({rows.length})</h1>
      {[...groups.values()].map((items) => (
        <div key={items[0].product.shop.id} className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm">
            {items[0].product.shop.isMall && <span className="rounded-sm bg-brand px-1.5 text-[10px] font-semibold text-white">Mall</span>}
            <Link href={`/shop/${items[0].product.shop.id}`} className="font-semibold hover:text-brand">{items[0].product.shop.name}</Link>
          </div>
          {items.map((r) => {
            const unavailable = r.product.stock === 0 || !r.product.visible || r.product.status !== 'APPROVED';
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3.5 border-t border-line px-4 py-3.5 first:border-t-0">
                <input type="checkbox" aria-label="Chọn" disabled={unavailable} checked={r.selected && !unavailable} onChange={() => patch(r, { selected: !r.selected })} className="h-[18px] w-[18px] accent-brand" />
                <Link href={`/product/${r.product.id}`}><ProductImage src={r.product.images[0]} alt={r.product.name} className="h-[72px] w-[72px] flex-none rounded-md" /></Link>
                <div className="flex min-w-0 flex-1 basis-52 flex-col gap-1">
                  <Link href={`/product/${r.product.id}`} className="line-clamp-2 text-sm hover:text-brand">{r.product.name}</Link>
                  {r.variant && <span className="text-xs text-muted">{r.variant}</span>}
                  {unavailable && <span className="text-xs text-red-700">Sản phẩm tạm hết hàng / ngừng bán</span>}
                </div>
                <b className="w-24 text-sm">{vnd(r.product.price)}đ</b>
                <div className="flex overflow-hidden rounded-md border border-line">
                  <button onClick={() => patch(r, { qty: Math.max(1, r.qty - 1) })} className="h-8 w-8 bg-white" aria-label="Giảm">−</button>
                  <span className="w-10 border-x border-line text-center text-[13px] leading-8">{r.qty}</span>
                  <button onClick={() => r.qty < r.product.stock ? patch(r, { qty: r.qty + 1 }) : toast(`Chỉ còn ${r.product.stock} sản phẩm`)} className="h-8 w-8 bg-white" aria-label="Tăng">+</button>
                </div>
                <b className="w-28 text-sm text-brand">{vnd(r.product.price * r.qty)}đ</b>
                <button onClick={() => remove(r)} className="text-[13px] text-muted hover:text-red-700">Xóa</button>
              </div>
            );
          })}
        </div>
      ))}
      <div className="card sticky bottom-0 flex flex-wrap items-center gap-4 p-4 shadow-[0_-4px_14px_rgba(0,0,0,.06)]">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allSel} onChange={selectAll} className="h-[18px] w-[18px] accent-brand" />Chọn tất cả</label>
        <Link href="/vouchers" className="text-[13px] text-brand">Kho voucher của tôi</Link>
        <span className="ml-auto text-sm">Tổng ({sel.length} sản phẩm): <b className="text-xl text-brand">{vnd(subtotal)}đ</b></span>
        <button onClick={() => (sel.length ? router.push('/checkout') : toast('Hãy chọn sản phẩm để mua'))} className="btn-primary px-9 py-3">Mua hàng</button>
      </div>
    </div>
  );
}

export default function CartPage() {
  return <RequireAuth><Cart /></RequireAuth>;
}
