import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <b className="text-6xl font-extrabold text-brand">404</b>
      <p className="text-muted">Trang bạn tìm không tồn tại.</p>
      <Link href="/" className="btn-primary">Về trang chủ Giá Tốt</Link>
    </div>
  );
}
