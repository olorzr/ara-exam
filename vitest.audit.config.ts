import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * 감사 스크립트 전용 설정 — `npm run audit:unsplittable`.
 * 평소 `npm test` 는 `*.test.ts` 만 돌아 이 스크립트를 건드리지 않는다(입력 덤프가 있어야 뜻이 있다).
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['scripts/**/*.audit.ts'],
    testTimeout: 600_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
