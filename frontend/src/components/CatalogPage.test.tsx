import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CatalogPage } from './CatalogPage';
import { publicApi } from '@/api/public';
import type { GameCard, PageResult } from '@/types';
vi.mock('@/api/public', () => ({
  publicApi: { categories: vi.fn(), games: vi.fn(), search: vi.fn() },
}));
const game = (name: string): GameCard => ({
  id: 1,
  name,
  slug: name,
  summary: '',
  status: 'PUBLISHED',
  viewCount: 0,
  resourceClickCount: 0,
  updatedAt: '2026-10-12',
  tags: [],
  platforms: [],
  languages: [],
});
const page = (name: string): PageResult<GameCard> => ({
  items: [game(name)],
  total: 1,
  pages: 1,
  page: 1,
  size: 20,
});
let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  vi.mocked(publicApi.categories).mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  client.clear();
});
const mount = () =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/games']}>
        <CatalogPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
it('cancels stale requests and retains the latest filter result', async () => {
  let resolveOld!: (value: PageResult<GameCard>) => void;
  let oldSignal: AbortSignal | undefined;
  vi.mocked(publicApi.games)
    .mockImplementationOnce((_params, options) => {
      oldSignal = options?.signal;
      return new Promise((resolve) => {
        resolveOld = resolve;
      });
    })
    .mockResolvedValueOnce(page('LatestFilterGame'));
  mount();
  fireEvent.change(screen.getByLabelText('排序方式'), { target: { value: 'views' } });
  expect(await screen.findByRole('heading', { name: 'LatestFilterGame' })).toBeTruthy();
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => {
    resolveOld(page('StaleFilterGame'));
  });
  expect(screen.queryByRole('heading', { name: 'StaleFilterGame' })).toBeNull();
  expect(screen.getByRole('heading', { name: 'LatestFilterGame' })).toBeTruthy();
  expect(publicApi.categories).toHaveBeenCalledTimes(1);
});
it('keeps games usable when category loading fails', async () => {
  vi.mocked(publicApi.categories).mockRejectedValue(new Error('category unavailable'));
  vi.mocked(publicApi.games).mockResolvedValue(page('AvailableGame'));
  mount();
  expect(await screen.findByRole('heading', { name: 'AvailableGame' })).toBeTruthy();
  expect(await screen.findByText(/分类暂时加载失败/)).toBeTruthy();
});
