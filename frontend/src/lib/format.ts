import type { OrderStatus } from './types';

export const vnd = (n: number | null | undefined) => (n ?? 0).toLocaleString('vi-VN');

export const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}tr` : n >= 1000 ? `${(n / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}k` : String(n);

export const date = (s: string | Date) => new Date(s).toLocaleDateString('vi-VN');
export const dateTime = (s: string | Date) =>
  new Date(s).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

export const discountPct = (price: number, original: number | null) => (original && original > price ? Math.round((1 - price / original) * 100) : 0);

export const initials = (name: string) =>
  name.split(/\s+/).filter((w) => /^\p{L}/u.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const ORDER_STATUS: Record<OrderStatus, { label: string; seller: string; color: string }> = {
  PENDING_PAYMENT: { label: 'Chờ thanh toán', seller: 'Chờ thanh toán', color: 'text-warn' },
  PENDING: { label: 'Chờ xác nhận', seller: 'Chờ xác nhận', color: 'text-warn' },
  CONFIRMED: { label: 'Chờ lấy hàng', seller: 'Chờ lấy hàng', color: 'text-brand' },
  SHIPPING: { label: 'Đang giao', seller: 'Đang giao', color: 'text-brand' },
  COMPLETED: { label: 'Hoàn thành', seller: 'Hoàn thành', color: 'text-ok' },
  CANCELLED: { label: 'Đã hủy', seller: 'Đã hủy', color: 'text-muted' },
};

export const ORDER_STEPS = ['Đặt hàng', 'Xác nhận', 'Đang vận chuyển', 'Giao thành công'];

export function stepIndex(s: OrderStatus) {
  return s === 'PENDING_PAYMENT' || s === 'PENDING' ? 0 : s === 'CONFIRMED' ? 1 : s === 'SHIPPING' ? 2 : s === 'COMPLETED' ? 3 : -1;
}

/** Hành động tiếp theo của người bán theo trạng thái đơn: [endpoint, nhãn nút]. */
export const SELLER_ACTION: Partial<Record<OrderStatus, [string, string]>> = {
  PENDING: ['confirm', 'Xác nhận đơn'],
  CONFIRMED: ['handover', 'Giao cho GHN'],
  SHIPPING: ['delivered', 'Đã giao xong'],
};

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
