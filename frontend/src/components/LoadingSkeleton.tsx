export function LoadingSkeleton({
  count = 8,
  variant = 'grid',
}: {
  count?: number;
  variant?: 'grid' | 'posters';
}) {
  const posters = variant === 'posters';
  return (
    <div
      className={
        posters
          ? 'popular-columns'
          : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5'
      }
    >
      {Array.from({ length: count }).map((_, i) => (
        <div className={posters ? 'popular-download-card' : 'card overflow-hidden'} key={i}>
          <div className="skeleton aspect-[2/3]" />
          <div className={posters ? 'space-y-2 pt-5 pb-2' : 'space-y-2 p-4'}>
            <div className="skeleton h-5 rounded" />
            <div className="skeleton h-4 w-2/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
