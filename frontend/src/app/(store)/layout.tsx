import { StoreFooter, StoreHeader } from '@/components/StoreHeader';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <StoreHeader />
      <main className="mx-auto w-full max-w-site flex-1 px-4 py-5">{children}</main>
      <StoreFooter />
    </div>
  );
}
