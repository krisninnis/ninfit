/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  // One source of truth for the version stamped into exports. Reading it from
  // package.json here means the backup metadata cannot drift from the app version.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // Relative base keeps the built app portable (any host, any sub-path).
  base: './',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  test: {
    // The domain layer is pure TypeScript, so no DOM environment is needed.
    environment: 'node',
    pool: 'threads',
    include: ['src/test/**/*.test.{ts,tsx}'],
    // Pin the suite to the user's timezone so the daylight-saving date tests are
    // meaningful. Under UTC, a local-date bug and a UTC-date bug look identical.
    env: { TZ: 'Europe/London' },
  },
});
