import http from './http';

export const gameApi = {
  list(params?: Record<string, unknown>) {
    return http.get('/games', { params });
  },
  detail(id: number | string) {
    return http.get(`/games/${id}`);
  },
  search(keyword: string) {
    return http.get('/search', { params: { q: keyword } });
  },
};
