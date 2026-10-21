'use client';

import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/DashboardShell';
import { Loading, Toggle } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { useApp } from '@/lib/app-context';

interface ShopSettings {
  name: string; description: string | null; pickupAddress: string | null; pickupPhone: string | null; city: string | null;
  districtId: number | null; wardCode: string | null;
  vacationMode: boolean; autoReply: boolean; acceptReturn: boolean; fastShipping: boolean;
}

const SWITCHES: [keyof ShopSettings, string, string][] = [
  ['vacationMode', 'Chế độ nghỉ', 'Tạm ẩn sản phẩm của shop khi nghỉ lễ'],
  ['autoReply', 'Tự động trả lời', 'Gửi tin nhắn chào khi khách nhắn'],
  ['acceptReturn', 'Chấp nhận đổi trả', 'Cho phép trả hàng trong 15 ngày'],
  ['fastShipping', 'Giao nhanh', 'Hiển thị tùy chọn giao nhanh'],
];

export default function SellerSettings() {
  const { toast, refreshUser } = useApp();
  const { data } = useApi<ShopSettings>('/seller/shop');
  const [f, setF] = useState<ShopSettings | null>(null);
  useEffect(() => { if (data) setF(data); }, [data]);
  if (!f) return <Loading />;

  const save = async () => {
    try {
      await api('/seller/shop', {
        method: 'PATCH',
        body: {
          name: f.name, description: f.description ?? '', pickupAddress: f.pickupAddress ?? '', pickupPhone: f.pickupPhone ?? '', city: f.city ?? '',
          districtId: f.districtId ?? undefined, wardCode: f.wardCode ?? undefined,
          vacationMode: f.vacationMode, autoReply: f.autoReply, acceptReturn: f.acceptReturn, fastShipping: f.fastShipping,
        },
      });
      await refreshUser();
      toast('Đã lưu cài đặt');
    } catch (e) { toast((e as Error).message); }
  };
  const text = (k: 'name' | 'description' | 'pickupAddress' | 'pickupPhone' | 'city', label: string) => (
    <label className="label">{label}<input className="input" value={(f[k] as string) ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  );

  return (
    <>
      <PageTitle>Cài đặt cửa hàng</PageTitle>
      <div className="flex max-w-3xl flex-col gap-3.5">
        <div className="card flex flex-col gap-3.5 p-5">
          <b>Thông tin shop</b>
          {text('name', 'Tên shop')}
          <label className="label">Giới thiệu<textarea rows={3} className="input" value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
          <div className="grid gap-3 sm:grid-cols-2">{text('pickupAddress', 'Địa chỉ lấy hàng')}{text('pickupPhone', 'SĐT lấy hàng')}{text('city', 'Tỉnh / Thành phố')}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="label">GHN District ID (tính phí ship)<input type="number" className="input" value={f.districtId ?? ''} onChange={(e) => setF({ ...f, districtId: +e.target.value || null })} /></label>
            <label className="label">GHN Ward Code<input className="input" value={f.wardCode ?? ''} onChange={(e) => setF({ ...f, wardCode: e.target.value })} /></label>
          </div>
        </div>
        <div className="card flex flex-col p-5">
          <b className="mb-2">Vận hành</b>
          {SWITCHES.map(([k, l, d]) => (
            <div key={k} className="flex items-center justify-between gap-3 border-t border-line py-3">
              <div className="flex flex-col gap-0.5"><span className="text-sm">{l}</span><span className="text-xs text-muted">{d}</span></div>
              <Toggle on={!!f[k]} label={l} onClick={() => setF({ ...f, [k]: !f[k] })} />
            </div>
          ))}
        </div>
        <button onClick={save} className="btn-primary self-start px-8 py-3">Lưu thay đổi</button>
      </div>
    </>
  );
}
