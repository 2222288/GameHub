import http, { type RequestOptions } from './http';
import { normalizeGamePayload } from '@/utils/gamePayload';
import type {
  AdminReport,
  AdminResourceLink,
  ApiResponse,
  Category,
  Dashboard,
  GameCard,
  GameDetail,
  PageResult,
  Tag,
} from '@/types';

export const adminApi = {
  login: (username: string, password: string) =>
    http
      .post<ApiResponse<{ token: string }>>('/auth/login', { username, password })
      .then((r) => r.data.data),
  dashboard: () => http.get<ApiResponse<Dashboard>>('/admin/dashboard').then((r) => r.data.data),
  games: (params: Record<string, unknown>) =>
    http
      .get<ApiResponse<PageResult<GameCard>>>('/admin/games', { params })
      .then((r) => r.data.data),
  game: (id: number, options?: RequestOptions) =>
    http.get<ApiResponse<GameDetail>>(`/admin/games/${id}`, options).then((r) => r.data.data),
  createGame: (data: unknown) =>
    http
      .post<ApiResponse<GameDetail>>('/admin/games', normalizeGamePayload(data))
      .then((r) => r.data.data),
  updateGame: (id: number, data: unknown) =>
    http
      .put<ApiResponse<GameDetail>>(`/admin/games/${id}`, normalizeGamePayload(data))
      .then((r) => r.data.data),
  action: (id: number, action: 'publish' | 'offline') => http.post(`/admin/games/${id}/${action}`),
  deleteGame: (id: number) => http.delete(`/admin/games/${id}`),
  categories: (options?: RequestOptions) =>
    http.get<ApiResponse<Category[]>>('/admin/categories', options).then((r) => r.data.data),
  saveCategory: (id: number | null, data: unknown) =>
    id ? http.put(`/admin/categories/${id}`, data) : http.post('/admin/categories', data),
  deleteCategory: (id: number) => http.delete(`/admin/categories/${id}`),
  tags: (q = '', options?: RequestOptions) =>
    http
      .get<ApiResponse<Tag[]>>('/admin/tags', { ...options, params: { q } })
      .then((r) => r.data.data),
  saveTag: (id: number | null, data: unknown) =>
    id ? http.put(`/admin/tags/${id}`, data) : http.post('/admin/tags', data),
  deleteTag: (id: number) => http.delete(`/admin/tags/${id}`),
  links: (status = '', q = '') =>
    http
      .get<ApiResponse<AdminResourceLink[]>>('/admin/resource-links', { params: { status, q } })
      .then((r) => r.data.data),
  gameLinks: (gameId: number, options?: RequestOptions) =>
    http
      .get<ApiResponse<AdminResourceLink[]>>(`/admin/games/${gameId}/resource-links`, options)
      .then((r) => r.data.data),
  addLink: (gameId: number, data: unknown) =>
    http.post(`/admin/games/${gameId}/resource-links`, data),
  updateLink: (id: number, data: unknown) => http.put(`/admin/resource-links/${id}`, data),
  deleteLink: (id: number) => http.delete(`/admin/resource-links/${id}`),
  reports: (status = '') =>
    http
      .get<ApiResponse<AdminReport[]>>('/admin/reports', { params: { status } })
      .then((r) => r.data.data),
  processReport: (id: number) => http.post(`/admin/reports/${id}/process`),
  setReportedLinkStatus: (id: number, status: string) =>
    http.post(`/admin/reports/${id}/resource-status`, null, { params: { status } }),
  deleteReportedLink: (id: number) => http.delete(`/admin/reports/${id}/resource-link`),
  upload: (form: FormData) => http.post('/admin/media/upload', form),
  reanalyzeCover: (gameId: number) =>
    http.post('/admin/media/cover/reanalyze', null, { params: { gameId } }),
  deleteMedia: (id: number) => http.delete(`/admin/media/${id}`),
};
