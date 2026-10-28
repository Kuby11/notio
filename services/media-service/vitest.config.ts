import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      // The service config provides the bindings: miniflare's R2 simulator in tests
      // runs the same code as the production bucket.
      wrangler: { configPath: './wrangler.jsonc' },
    })),
  ],
  test: {
    name: '@notio/media-service',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
