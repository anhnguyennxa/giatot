export type Role = 'BUYER' | 'SELLER' | 'ADMIN';
export type Approval = 'PENDING' | 'APPROVED' | 'REJECTED';
export type OrderStatus = 'PENDING_PAYMENT' | 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';

export interface User {
  id: number;
  email: string;
  phone: string | null;
  name: string;
  role: Role;
  avatar: string | null;
  xu: number;
  shop: { id: number; name: string; status: Approval } | null;
}

export interface ProductCard {
  id: number;
  name: string;
  price: number;
  originalPrice: number | null;
  sold: number;
  rating: number;
  images: string[];
  freeShip: boolean;
  stock: number;
  shop: { id: number; name: string; city: string | null; isMall: boolean };
  brand: { id: number; name: string } | null;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  visible: boolean;
  parentId: number | null;
  children?: Category[];
  brands?: { id: number; name: string }[];
}

export interface Banner {
  id: number;
  title: string;
  subtitle: string | null;
  image: string | null;
  link: string | null;
  position: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export interface Shop {
  id: number;
  name: string;
  description: string | null;
  logo: string | null;
  cover: string | null;
  isMall: boolean;
  rating: number;
  followers: number;
  city: string | null;
  createdAt: string;
}

export interface Address {
  id: number;
  fullName: string;
  phone: string;
  line: string;
  provinceId: number;
  provinceName: string;
  districtId: number;
  districtName: string;
  wardCode: string;
  wardName: string;
  isDefault: boolean;
}

export interface OrderItem {
  id: number;
  productId: number;
  name: string;
  image: string | null;
  price: number;
  qty: number;
  variant: string;
  reviewed: boolean;
}

export interface ReturnRequest {
  id: number;
  code: string;
  reason: string;
  description: string;
  amount: number;
  status: 'PENDING' | 'REFUNDED' | 'REJECTED';
  createdAt: string;
}

export interface Order {
  id: number;
  code: string;
  status: OrderStatus;
  paymentMethod: 'COD' | 'VNPAY';
  paymentStatus: 'UNPAID' | 'PAID' | 'FAILED' | 'REFUNDED';
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  shipName: string;
  shipPhone: string;
  shipAddress: string;
  shippingService: string;
  ghnOrderCode: string | null;
  expectedDelivery: string | null;
  cancelReason: string | null;
  note: string | null;
  createdAt: string;
  items: OrderItem[];
  shop?: { id: number; name: string; isMall: boolean };
  buyer?: { name: string; email?: string };
  returnRequest: ReturnRequest | null;
}

export interface Voucher {
  id: number;
  code: string;
  name: string;
  scope: 'PLATFORM' | 'SHOP';
  kind: 'DISCOUNT' | 'SHIPPING';
  discount: number;
  minOrder: number;
  quantity: number;
  used: number;
  active: boolean;
  expiresAt: string | null;
  shop?: { id: number; name: string } | null;
}

export interface Notification {
  id: number;
  type: 'ORDER' | 'PROMO' | 'SYSTEM';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}
