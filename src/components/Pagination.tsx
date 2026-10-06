"use client";

/** Page numbers to show: first, last, and current ±1, with gaps marked as null. */
function visiblePages(page: number, count: number): (number | null)[] {
  const pages: (number | null)[] = [];
  for (let p = 1; p <= count; p++) {
    if (p === 1 || p === count || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== null) pages.push(null);
  }
  return pages;
}

export default function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  const btn = "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium transition";
  return (
    <nav className="flex flex-wrap items-center justify-center gap-1" aria-label="გვერდები">
      <button
        className={`${btn} text-slate-600 hover:bg-slate-100 disabled:opacity-30`}
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        aria-label="წინა გვერდი"
      >
        ‹
      </button>
      {visiblePages(page, pageCount).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-slate-400">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={`${btn} ${
              p === page
                ? "bg-teal-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        className={`${btn} text-slate-600 hover:bg-slate-100 disabled:opacity-30`}
        disabled={page === pageCount}
        onClick={() => onChange(page + 1)}
        aria-label="შემდეგი გვერდი"
      >
        ›
      </button>
    </nav>
  );
}
