/**
 * vite.config.ts
 *
 * - base './': relative asset URLs, so one build works on localhost, behind a
 *   domain, and under any base path (BDELKO_BASE_PATH) without rebuilding.
 * - Dev proxy: forwards /api to the running backend (VITE_BDELKO_BACKEND_URL),
 *   prefixing the path with VITE_BDELKO_BASE_PATH when the backend itself is
 *   mounted under a base path. Values come from ui/.env (gitignored).
 */
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // Third arg '' = load all vars (not only VITE_*), ui/.env included.
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.VITE_BDELKO_BACKEND_URL || 'http://127.0.0.1:3001';
  const basePath = (env.VITE_BDELKO_BASE_PATH || '').replace(/^\/+|\/+$/g, '');

  return {
    base: './',
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backend,
          changeOrigin: true,
          // Backend mounts the API at [basePath]/api - mirror that in dev.
          rewrite: (p) => (basePath ? `/${basePath}${p}` : p),
        },
      },
    },
    test: {
      environment: 'node',
    },
  };
});
