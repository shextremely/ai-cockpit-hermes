import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

const BFF_PORT = process.env.BFF_PORT ?? '5180';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    // Hermes API Server 已占用 5173,前端开发服改用 5174
    port: 5174,
    strictPort: true,
    proxy: {
      // 开发期把 /api 代理到 BFF,避免 CORS 与密钥外泄
      '/api': {
        target: `http://localhost:${BFF_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
