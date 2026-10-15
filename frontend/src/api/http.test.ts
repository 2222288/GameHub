import { beforeEach, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import http from './http';
import { useAuth } from '@/stores/auth';
beforeEach(() => useAuth.getState().logout());
it('omits admin credentials from public requests and login', async () => {
  useAuth.getState().setToken('test-token');
  for (const url of ['/games', '/auth/login']) {
    await http.get(url, {
      adapter: async (config) => {
        expect(config.headers.get('Authorization')).toBeUndefined();
        return {
          data: { code: 0, data: [] },
          status: 200,
          statusText: 'OK',
          config,
          headers: new AxiosHeaders(),
        };
      },
    });
  }
});
it('includes the token on protected requests', async () => {
  useAuth.getState().setToken('test-token');
  await http.get('/admin/games', {
    adapter: async (config) => {
      expect(config.headers.get('Authorization')).toBe('Bearer test-token');
      return {
        data: { code: 0 },
        status: 200,
        statusText: 'OK',
        config,
        headers: new AxiosHeaders(),
      };
    },
  });
});
it.each([401, 403])('handles HTTP %s without a redirect loop', async (status) => {
  useAuth.getState().setToken('test-token');
  await expect(
    http.get('/admin/games', {
      adapter: async (config) => {
        const response: AxiosResponse = {
          data: { message: 'denied' },
          status,
          statusText: 'Denied',
          config,
          headers: new AxiosHeaders(),
        };
        throw new AxiosError('denied', AxiosError.ERR_BAD_REQUEST, config, undefined, response);
      },
    }),
  ).rejects.toThrow('denied');
  expect(useAuth.getState().token).toBe(status === 401 ? null : 'test-token');
});
