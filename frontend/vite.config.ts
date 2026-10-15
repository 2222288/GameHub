import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: env.API_PROXY_TARGET || 'http://localhost:8080', changeOrigin: true },
        '/assets/games': {
          target: env.MEDIA_PROXY_TARGET || 'http://localhost:9000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/assets/, '/gamehub'),
        },
        '/media': {
          target: env.MEDIA_PROXY_TARGET || 'http://localhost:9000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/media/, ''),
        },
      },
    },
    build: { target: 'es2022' },
  };
});
