import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const { process: nodeProcess } = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

const apiTarget = nodeProcess?.env?.VITE_API_URL ?? 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    coverage: {
      provider: 'v8'
    }
  }
});
