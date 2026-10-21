'use client';

import { usePathname } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { RequireAuth } from '@/components/ui';
import { useApi } from '@/lib/api';

interface Todos { todos: { pendingShops: number; pendingProducts: number; openReturns: number } }

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  // Tải lại số việc cần xử lý mỗi lần chuyển trang.
  const { data } = useApi<Todos>(`/admin/overview?_=${encodeURIComponent(path)}`);
  const t = data?.todos;
  const nav = [
    { href: '/admin', label: 'Tổng quan' },
    { href: '/admin/sellers', label: 'Duyệt người bán', badge: t?.pendingShops },
    { href: '/admin/users', label: 'Người dùng' },
    { href: '/admin/categories', label: 'Danh mục và thương hiệu' },
    { href: '/admin/products', label: 'Duyệt sản phẩm', badge: t?.pendingProducts },
    { href: '/admin/vouchers', label: 'Voucher sàn' },
    { href: '/admin/returns', label: 'Khiếu nại và hoàn tiền', badge: t?.openReturns },
    { href: '/admin/banners', label: 'Banner trang chủ' },
    { href: '/admin/reports', label: 'Báo cáo doanh thu' },
  ];
  return <DashboardShell variant="admin" title="Admin" nav={nav}>{children}</DashboardShell>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth role="ADMIN"><Shell>{children}</Shell></RequireAuth>;
}
