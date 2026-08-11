import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // 统一资源路径前缀（生产部署在 nginx 19095 的 /maas-web/ 下）
  base: '/maas-web/',
  plugins: [react(), tailwindcss()],
  build: {
    // 资源目录避开前端路由名（/assets 为模型资产页路由；同名目录会被 nginx 目录重定向 301 后 403）
    assetsDir: '_assets',
  },
  server: {
    port: 5173,
    host: true,
  },
})
