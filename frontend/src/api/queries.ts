import { QueryClient, queryOptions } from '@tanstack/react-query';
import { publicApi } from './public';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 300_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
export const categoriesQuery = queryOptions({
  queryKey: ['public', 'categories'],
  queryFn: ({ signal }) => publicApi.categories({ signal }),
  staleTime: 300_000,
});
