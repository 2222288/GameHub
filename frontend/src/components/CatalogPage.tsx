import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { publicApi } from '@/api/public';
import { categoriesQuery } from '@/api/queries';
import { errorMessage } from '@/api/http';
import { catalogParams } from '@/utils/catalogParams';
import { SearchBar } from './SearchBar';
import { FilterBar, type Filters } from './FilterBar';
import { GameGrid } from './GameGrid';
import { LoadingSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Pagination } from './Pagination';

export function CatalogPage({ searching = false }: { searching?: boolean }) {
  const [sp, setSp] = useSearchParams();
  const q = (sp.get('q') || '').trim();
  const { filters, params } = catalogParams(sp, searching);
  const categories = useQuery(categoriesQuery);
  const result = useQuery({
    queryKey: [
      'public',
      searching ? 'search' : 'games',
      { ...params, ...(searching ? { q } : {}) },
    ],
    queryFn: ({ signal }) =>
      searching
        ? publicApi.search({ ...params, q }, { signal })
        : publicApi.games(params, { signal }),
  });
  const data = result.data;
  useEffect(() => {
    if (data && data.pages > 0 && params.page > data.pages) {
      const next = new URLSearchParams(sp);
      next.set('page', String(data.pages));
      setSp(next, { replace: true });
    }
  }, [data, params.page, sp, setSp]);
  const changeFilters = (next: Filters) => {
    const updated = new URLSearchParams(sp);
    Object.entries(next).forEach(([key, value]) =>
      value ? updated.set(key, value) : updated.delete(key),
    );
    updated.set('page', '1');
    setSp(updated);
  };
  const changePage = (page: number) => {
    const next = new URLSearchParams(sp);
    next.set('page', String(page));
    setSp(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <div className="container-page py-10 md:py-14">
      <div className="mb-8">
        <p className="eyebrow">{searching ? 'FIND YOUR NEXT GAME' : 'THE GAME LIBRARY'}</p>
        <h1 className="mt-3 text-3xl font-black md:text-4xl">
          {searching ? '搜索游戏' : '探索游戏库'}
        </h1>
        <p className="mt-3 text-sm text-ink-2">
          {searching
            ? '按名称、类型和平台，找到你想玩的作品。'
            : '从熟悉的经典到新的惊喜，找到属于你的游戏。'}
        </p>
        {searching && (
          <div className="mt-6">
            <SearchBar large />
          </div>
        )}
      </div>
      <FilterBar
        categories={categories.data || []}
        value={filters}
        onChange={changeFilters}
        showRelevance={searching}
      />
      {categories.isError && (
        <p className="mt-3 text-sm text-amber-600">
          分类暂时加载失败，仍可使用其他条件筛选。
          <button className="ml-2 underline" onClick={() => void categories.refetch()}>
            重试
          </button>
        </p>
      )}
      <div className="mt-6 min-h-5 text-sm text-ink-2" role="status">
        {data && (
          <>
            共 {data.total.toLocaleString()} 款游戏{q && <> · “{q}”</>}
            {result.isFetching && ' · 更新中…'}
          </>
        )}
      </div>
      <div className="mt-5" aria-busy={result.isFetching}>
        {result.isPending ? (
          <LoadingSkeleton count={12} />
        ) : result.isError ? (
          <ErrorState message={errorMessage(result.error)} retry={() => void result.refetch()} />
        ) : data?.items.length ? (
          <>
            <GameGrid games={data.items} />
            <Pagination page={params.page} pages={data.pages} onPage={changePage} />
          </>
        ) : (
          <EmptyState query={q} />
        )}
      </div>
    </div>
  );
}
