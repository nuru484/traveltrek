// vitest.config.ts
import 'dotenv/config'; // load .env so all required env vars are present
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// Integration tests run against a dedicated test database so they never touch
// development data. We derive its URL from the real DATABASE_URL (same host /
// credentials) and just swap the database name to `traveltrek_test`.
const baseDbUrl = process.env.DATABASE_URL ?? '';
const testDbUrl = baseDbUrl.replace(/\/[^/?]+(\?|$)/, '/traveltrek_test$1');

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    env: {
      // Empty so auth cookies carry no Domain attribute — supertest hits
      // 127.0.0.1, which wouldn't match a Domain=localhost cookie, breaking
      // the cookie jar on authenticated requests.
      COOKIE_DOMAIN: '',
      DATABASE_URL: testDbUrl,
      NODE_ENV: 'test',
      // A known secret so webhook-signature tests can sign payloads deterministically.
      PAYSTACK_SECRET_KEY: 'sk_test_vitest',
    },
    environment: 'node',
    // Integration tests share one Postgres database and reset it between tests,
    // so they must not run concurrently.
    fileParallelism: false,
    globals: true,
    globalSetup: ['./test/global-setup.ts'],
    hookTimeout: 30000,
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    maxWorkers: 1,
    pool: 'forks',
    setupFiles: ['./test/setup.ts'],
    testTimeout: 20000,
  },
});
