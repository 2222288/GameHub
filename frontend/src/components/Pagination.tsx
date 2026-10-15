export function Pagination({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
}) {
  if (pages <= 1) return null;
  const start = Math.max(1, Math.min(Math.max(1, pages - 4), page - 2));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, index) => start + index);
  return (
    <nav
      aria-label="游戏列表分页"
      className="mt-10 flex flex-wrap items-center justify-center gap-2"
    >
      <button
        className="btn btn-secondary"
        aria-label="上一页"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        ←
      </button>
      {start > 1 && (
        <button className="btn btn-secondary" onClick={() => onPage(1)}>
          1
        </button>
      )}
      {start > 2 && <span className="px-1 text-ink-3">…</span>}
      {numbers.map((number) => (
        <button
          key={number}
          aria-label={`第 ${number} 页`}
          aria-current={number === page ? 'page' : undefined}
          className={`btn ${number === page ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => onPage(number)}
        >
          {number}
        </button>
      ))}
      {numbers.at(-1)! < pages - 1 && <span className="px-1 text-ink-3">…</span>}
      {numbers.at(-1)! < pages && (
        <button className="btn btn-secondary" onClick={() => onPage(pages)}>
          {pages}
        </button>
      )}
      <button
        className="btn btn-secondary"
        aria-label="下一页"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        →
      </button>
    </nav>
  );
}
