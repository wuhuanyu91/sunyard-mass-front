import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/maas-web/',
  plugins: [react(), tailwindcss()],
  build: {
    assetsDir: '_assets',
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/smart-router': {
        target: 'http://localhost:9090',
        changeOrigin: true,
      },
    },
  },
})