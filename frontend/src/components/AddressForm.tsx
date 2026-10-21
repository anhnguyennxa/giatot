'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Address } from '@/lib/types';

type Loc = { id: number; name: string };

/** Form địa chỉ dùng danh mục tỉnh/quận/phường của GHN. */
export function AddressForm({ initial, onSaved, onCancel }: { initial?: Address; onSaved: (a: Address) => void; onCancel?: () => void }) {
  const [f, setF] = useState({
    fullName: initial?.fullName ?? '', phone: initial?.phone ?? '', line: initial?.line ?? '',
    provinceId: initial?.provinceId ?? 0, districtId: initial?.districtId ?? 0, wardCode: initial?.wardCode ?? '',
    isDefault: initial?.isDefault ?? false,
  });
  const [provinces, setProvinces] = useState<Loc[]>([]);
  const [districts, setDistricts] = useState<Loc[]>([]);
  const [wards, setWards] = useState<{ code: string; name: string }[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<Loc[]>('/shipping/provinces').then(setProvinces).catch((e) => setErr(e.message)); }, []);
  useEffect(() => {
    setDistricts([]);
    if (f.provinceId) api<Loc[]>(`/shipping/districts?provinceId=${f.provinceId}`).then(setDistricts).catch(() => undefined);
  }, [f.provinceId]);
  useEffect(() => {
    setWards([]);
    if (f.districtId) api<{ code: string; name: string }[]>(`/shipping/wards?districtId=${f.districtId}`).then(setWards).catch(() => undefined);
  }, [f.districtId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = provinces.find((x) => x.id === f.provinceId);
    const d = districts.find((x) => x.id === f.districtId);
    const w = wards.find((x) => x.code === f.wardCode);
    if (!p || !d || !w) return setErr('Vui lòng chọn đủ Tỉnh/Thành, Quận/Huyện, Phường/Xã');
    setBusy(true);
    try {
      const body = { ...f, provinceName: p.name, districtName: d.name, wardName: w.name };
      const saved = await api<Address>(initial ? `/addresses/${initial.id}` : '/addresses', { method: initial ? 'PUT' : 'POST', body });
      onSaved(saved);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="label">Họ tên<input required className="input" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></label>
      <label className="label">Số điện thoại<input required className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
      <label className="label">Tỉnh / Thành phố
        <select className="input" value={f.provinceId} onChange={(e) => setF({ ...f, provinceId: +e.target.value, districtId: 0, wardCode: '' })}>
          <option value={0}>-- Chọn --</option>
          {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="label">Quận / Huyện
        <select className="input" value={f.districtId} onChange={(e) => setF({ ...f, districtId: +e.target.value, wardCode: '' })}>
          <option value={0}>-- Chọn --</option>
          {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
      <label className="label">Phường / Xã
        <select className="input" value={f.wardCode} onChange={(e) => setF({ ...f, wardCode: e.target.value })}>
          <option value="">-- Chọn --</option>
          {wards.map((w) => <option key={w.code} value={w.code}>{w.name}</option>)}
        </select>
      </label>
      <label className="label">Số nhà, tên đường<input required className="input" value={f.line} onChange={(e) => setF({ ...f, line: e.target.value })} /></label>
      <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
        <input type="checkbox" className="accent-brand" checked={f.isDefault} onChange={(e) => setF({ ...f, isDefault: e.target.checked })} /> Đặt làm địa chỉ mặc định
      </label>
      {err && <p className="text-sm text-red-700 sm:col-span-2">{err}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button disabled={busy} className="btn-primary">{initial ? 'Lưu địa chỉ' : 'Thêm địa chỉ'}</button>
        {onCancel && <button type="button" onClick={onCancel} className="btn-ghost">Hủy</button>}
      </div>
    </form>
  );
}
