import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Tailwind 제거 - oklch 호환성 문제 해결
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
})
