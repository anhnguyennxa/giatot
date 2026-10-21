'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { Loading, RequireAuth } from '@/components/ui';
import { useApp } from '@/lib/app-context';

const NAV = [
  { href: '/seller', label: 'Tổng quan' },
  { href: '/seller/products', label: 'Sản phẩm' },
  { href: '/seller/orders', label: 'Đơn hàng' },
  { href: '/seller/vouchers', label: 'Khuyến mãi' },
  { href: '/seller/finance', label: 'Tài chính' },
  { href: '/seller/analytics', label: 'Phân tích' },
  { href: '/seller/settings', label: 'Cài đặt shop' },
];

function Gate({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const path = usePathname();
  const router = useRouter();
  const onRegister = path === '/seller/register';

  useEffect(() => {
    if (user && !user.shop && !onRegister) router.replace('/seller/register');
  }, [user, onRegister, router]);

  if (!user?.shop && !onRegister) return <Loading />;
  const status = user?.shop?.status;

  return (
    <DashboardShell variant="seller" title="Kênh người bán" nav={user?.shop ? NAV : [{ href: '/seller/register', label: 'Đăng ký bán hàng' }]}>
      {status === 'PENDING' && <div className="rounded-lg border border-gold bg-gold-light p-3.5 text-sm text-gold-dark">Hồ sơ cửa hàng đang chờ Giá Tốt xét duyệt (1-3 ngày làm việc). Bạn có thể chuẩn bị sản phẩm trước.</div>}
      {status === 'REJECTED' && <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">Hồ sơ cửa hàng bị từ chối. Vui lòng cập nhật thông tin trong <Link href="/seller/settings" className="underline">Cài đặt shop</Link> và liên hệ quản trị viên.</div>}
      {children}
    </DashboardShell>
  );
}

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth><Gate>{children}</Gate></RequireAuth>;
}
