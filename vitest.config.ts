import { defineConfig } from 'vitest/config';
import path from 'path';

// Kept separate from vite.config.ts so the app build config stays untouched;
// utility tests run in a plain node environment (no jsdom needed).
// Component tests (*.test.tsx) can opt into jsdom via // @vitest-environment jsdom docblock.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
