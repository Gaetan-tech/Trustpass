import { defineConfig } from 'vitest/config';

// Environnement de test : valeurs factices suffisantes pour instancier l'app.
// Les tests d'intégration touchant la vraie DB/Redis utiliseront un .env.test dédié.
export default defineConfig({
  test: {
    exclude: ['node_modules', 'dist', 'tests/integration/**'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/trustpass_test?schema=public',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'test-secret-value-1234567890',
      JWT_REFRESH_SECRET: 'test-refresh-secret-1234567890',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
    },
  },
});
