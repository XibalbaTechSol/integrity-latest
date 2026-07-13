import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  },
  define: {
    '__BUNDLED_DEV__': 'true',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // e2e/ is a separate Playwright suite (run via `npm run test:e2e`),
    // not a vitest one — its *.spec.ts files would otherwise match
    // vitest's default glob and fail to even collect (Playwright's
    // test.describe() throws outside a Playwright test runner).
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
