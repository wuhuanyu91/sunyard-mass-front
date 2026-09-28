import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // 后端联调在 Java 侧已覆盖，此处只验证前端调用契约（URL/方法/令牌/body），避免依赖真实服务
    pool: 'threads',
  },
});
