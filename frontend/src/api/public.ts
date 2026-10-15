import http, { type RequestOptions } from './http';
import type {
  ApiResponse,
  Category,
  GameCard,
  GameDetail,
  PageResult,
  ResourceLink,
  WallGame,
} from '@/types';
export const publicApi = {
  categories: (options?: RequestOptions) =>
    http.get<ApiResponse<Category[]>>('/categories', options).then((r) => r.data.data),
  latest: (options?: RequestOptions) =>
    http.get<ApiResponse<GameCard[]>>('/games/latest', options).then((r) => r.data.data),
  wall: (options?: RequestOptions) =>
    http
      .get<ApiResponse<WallGame[]>>('/games/wall', { ...options, params: { size: 120 } })
      .then((r) => r.data.data),
  games: (params: Record<string, unknown>, options?: RequestOptions) =>
    http
      .get<ApiResponse<PageResult<GameCard>>>('/games', { ...options, params })
      .then((r) => r.data.data),
  search: (params: Record<string, unknown>, options?: RequestOptions) =>
    http
      .get<ApiResponse<PageResult<GameCard>>>('/search', { ...options, params })
      .then((r) => r.data.data),
  detail: (slug: string, options?: RequestOptions) =>
    http
      .get<ApiResponse<GameDetail>>(`/games/${encodeURIComponent(slug)}`, options)
      .then((r) => r.data.data),
  links: (id: number, options?: RequestOptions) =>
    http
      .get<ApiResponse<ResourceLink[]>>(`/games/${id}/resource-links`, options)
      .then((r) => r.data.data),
  click: (id: number) =>
    http.post<ApiResponse<{ url: string }>>(`/resource-links/${id}/click`).then((r) => r.data.data),
  report: (id: number, reason: string) => http.post(`/resource-links/${id}/report`, { reason }),
};
