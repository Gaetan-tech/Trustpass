import { defineConfig } from 'vitest/config';

// Config des tests d'intégration : DB Postgres + Redis réels via testcontainers.
// DATABASE_URL / REDIS_URL sont fixés à chaud dans le beforeAll (conteneurs éphémères).
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'integration-secret-1234567890',
      JWT_REFRESH_SECRET: 'integration-refresh-1234567890',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
    },
  },
});
