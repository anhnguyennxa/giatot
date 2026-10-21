import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { AppProvider } from '@/lib/app-context';
import './globals.css';

const font = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-be-vietnam',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Giá Tốt - Mua đúng giá · Sắm thật vui', template: '%s | Giá Tốt' },
  description: 'Sàn thương mại điện tử Giá Tốt: hàng chính hãng, thanh toán VNPay, giao hàng nhanh GHN.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={font.variable}>
      <body className="font-sans">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
