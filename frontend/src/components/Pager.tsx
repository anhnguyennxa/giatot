'use client';

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex justify-center gap-2 py-2">
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          onClick={() => { onPage(p); window.scrollTo(0, 0); }}
          className={`h-9 w-9 rounded-md border text-sm ${p === page ? 'border-brand bg-brand text-white' : 'border-line bg-white'}`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
