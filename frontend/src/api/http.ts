import axios from 'axios';
import { useAuth } from '@/stores/auth';
export type RequestOptions = { signal?: AbortSignal };
export function errorMessage(error: unknown, fallback = '请求失败，请稍后重试。'): string {
  if (axios.isAxiosError(error)) return error.response?.data?.message || fallback;
  return error instanceof Error ? error.message : fallback;
}
const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15_000,
});
http.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  if (token && config.url?.startsWith('/admin/')) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
http.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && typeof body.code === 'number' && body.code !== 0)
      return Promise.reject(new Error(body.message || '请求失败，请稍后重试。'));
    return response;
  },
  (error) => {
    // A permissions error does not mean the user's session has expired.
    if (error.response?.status === 401 && error.config?.url?.startsWith('/admin/'))
      useAuth.getState().logout();
    return Promise.reject(error);
  },
);
export default http;
