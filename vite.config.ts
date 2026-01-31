import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Tailwind 제거 - oklch 호환성 문제 해결
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api/notion': {
        target: 'https://api.notion.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/notion/, ''),
        headers: {
          'Notion-Version': '2022-06-28',
        },
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
