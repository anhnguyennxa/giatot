'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Empty, Loading, ProductImage, RequireAuth } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import type { Order, OrderItem } from '@/lib/types';

const TAGS = ['Đúng mô tả', 'Chất lượng tốt', 'Đóng gói kỹ', 'Giao nhanh', 'Shop nhiệt tình'];
const STAR_TEXT = ['', 'Rất tệ', 'Tệ', 'Bình thường', 'Hài lòng', 'Tuyệt vời'];

function ItemReview({ item, onDone }: { item: OrderItem; onDone: () => void }) {
  const { toast, refreshUser } = useApp();
  const [stars, setStars] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api('/reviews', { body: { orderItemId: item.id, rating: stars, content, tags } });
      toast('Cảm ơn bạn đã đánh giá, +200 xu');
      refreshUser();
      onDone();
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-4 first:border-0 first:pt-0">
      <div className="flex items-center gap-3"><ProductImage src={item.image} alt={item.name} className="h-[60px] w-[60px] rounded-md" /><span className="text-sm">{item.name}</span></div>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setStars(n)} className={`text-3xl ${n <= stars ? 'text-gold' : 'text-line'}`} aria-label={`${n} sao`}>★</button>
        ))}
        <span className="ml-2 text-[13px] text-brand">{STAR_TEXT[stars]}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {TAGS.map((t) => (
          <button key={t} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])} className={`chip ${tags.includes(t) ? 'chip-on' : 'chip-off'}`}>{t}</button>
        ))}
      </div>
      <textarea rows={4} className="input" placeholder="Hãy chia sẻ nhận xét của bạn về sản phẩm" value={content} onChange={(e) => setContent(e.target.value)} />
      <button disabled={busy} onClick={submit} className="btn-primary self-start px-8">Gửi đánh giá</button>
    </div>
  );
}

function Review() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: o, loading, reload } = useApi<Order>(`/orders/${id}`);
  if (loading && !o) return <Loading />;
  if (!o) return <Empty>Không tìm thấy đơn hàng</Empty>;
  const pending = o.items.filter((i) => !i.reviewed);
  return (
    <div className="card mx-auto flex max-w-2xl flex-col gap-5 p-6">
      <b className="text-lg">Đánh giá sản phẩm · {o.code}</b>
      {pending.length === 0 ? (
        <Empty action={<button onClick={() => router.push('/orders')} className="btn-primary">Về đơn mua</button>}>Bạn đã đánh giá tất cả sản phẩm trong đơn.</Empty>
      ) : pending.map((i) => <ItemReview key={i.id} item={i} onDone={reload} />)}
    </div>
  );
}

export default function ReviewPage() {
  return <RequireAuth><Review /></RequireAuth>;
}
