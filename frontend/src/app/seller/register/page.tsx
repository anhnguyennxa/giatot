'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Steps } from '@/components/ui';
import { api } from '@/lib/api';
import { useApp } from '@/lib/app-context';

export default function SellerRegister() {
  const { user, refreshUser, toast } = useApp();
  const [step, setStep] = useState(user?.shop ? 2 : 0);
  const [f, setF] = useState({ name: '', pickupAddress: '', pickupPhone: user?.phone ?? '', city: '', businessType: 'Cá nhân', fullName: '', idNumber: '' });
  const [busy, setBusy] = useState(false);

  const next = async () => {
    if (step === 0) {
      if (f.name.trim().length < 3 || f.pickupAddress.trim().length < 5 || f.pickupPhone.trim().length < 8) return toast('Nhập đủ tên shop, địa chỉ và số điện thoại');
      return setStep(1);
    }
    if (step === 1) {
      if (!f.fullName.trim() || !f.idNumber.trim()) return toast('Nhập họ tên và số CCCD');
      setBusy(true);
      try {
        await api('/seller/register', {
          body: { name: f.name, pickupAddress: f.pickupAddress, pickupPhone: f.pickupPhone, city: f.city, businessType: f.businessType, idNumber: f.idNumber, documents: `CCCD của ${f.fullName}` },
        });
        await refreshUser();
        setStep(2);
      } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
    }
  };

  const input = (k: keyof typeof f, ph: string) => <input placeholder={ph} className="input py-3" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />;

  return (
    <div className="card mx-auto flex w-full max-w-xl flex-col gap-5 p-7">
      <b className="text-xl">Đăng ký bán hàng trên Giá Tốt</b>
      <Steps steps={['Thông tin shop', 'Định danh', 'Hoàn tất']} current={step} />
      {step === 0 && <div className="flex flex-col gap-3">{input('name', 'Tên shop')}{input('pickupAddress', 'Địa chỉ lấy hàng')}{input('city', 'Tỉnh / Thành phố')}{input('pickupPhone', 'Số điện thoại')}</div>}
      {step === 1 && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2.5">
            {['Cá nhân', 'Hộ kinh doanh', 'Doanh nghiệp'].map((t) => (
              <button key={t} onClick={() => setF({ ...f, businessType: t })} className={`chip flex-1 rounded-md py-2.5 ${f.businessType === t ? 'chip-on' : 'chip-off'}`}>{t}</button>
            ))}
          </div>
          {input('fullName', 'Họ tên theo CCCD')}
          {input('idNumber', 'Số CCCD')}
          <p className="text-xs text-muted">Ảnh CCCD sẽ được bổ sung qua email theo yêu cầu của bộ phận xét duyệt.</p>
        </div>
      )}
      {step === 2 && (
        <div className="rounded-lg bg-ok-light p-5 text-sm leading-relaxed text-ok">
          Hồ sơ đã được gửi. Giá Tốt sẽ xét duyệt trong 1 đến 3 ngày làm việc và gửi thông báo cho bạn.
        </div>
      )}
      <div className="flex gap-2.5">
        {step === 1 && <button onClick={() => setStep(0)} className="btn-ghost px-6">Quay lại</button>}
        {step < 2 ? <button disabled={busy} onClick={next} className="btn-primary px-8">{step === 0 ? 'Tiếp theo' : 'Gửi hồ sơ'}</button>
          : <Link href="/seller" className="btn-primary px-8">Vào kênh người bán</Link>}
      </div>
    </div>
  );
}
