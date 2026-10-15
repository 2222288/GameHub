import type { Filters } from '@/components/FilterBar';

export function positiveInteger(value: string | null, fallback: number, max = 1_000_000) {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, max) : fallback;
}

export function catalogParams(sp: URLSearchParams, searching = false) {
  const allowedSorts = ['updated', 'published', 'views', 'resources', 'name'];
  if (searching) allowedSorts.push('relevance');
  const defaultSort = searching ? 'relevance' : 'updated';
  const sort = sp.get('sort') || defaultSort;
  const size = sp.get('size') || '20';
  const rawCategory = sp.get('category');
  const filters: Filters = {
    category:
      rawCategory &&
      /^\d+$/.test(rawCategory) &&
      Number.isSafeInteger(Number(rawCategory)) &&
      Number(rawCategory) > 0
        ? rawCategory
        : '',
    tag: sp.get('tag') || '',
    platform: sp.get('platform') || '',
    language: sp.get('language') || '',
    sort: allowedSorts.includes(sort) ? sort : defaultSort,
    size: ['20', '40', '60'].includes(size) ? size : '20',
  };
  return {
    filters,
    params: {
      page: positiveInteger(sp.get('page'), 1),
      size: Number(filters.size),
      category: filters.category || undefined,
      tag: filters.tag || undefined,
      platform: filters.platform || undefined,
      language: filters.language || undefined,
      sort: filters.sort,
    },
  };
}
