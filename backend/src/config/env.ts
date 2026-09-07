import 'dotenv/config'; // charge .env en dev (ne réécrit pas les variables déjà définies)
import { z } from 'zod';

// Validation stricte de l'environnement au démarrage (fail-fast).
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  // Taille du pool de connexions Prisma (dimensionnée pour le pic — cf. AN-2026-017).
  DATABASE_CONNECTION_LIMIT: z.coerce.number().int().positive().default(20),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  // Feature flag du paiement Stripe réel. OFF par défaut : la fonctionnalité est
  // livrée en prod mais n'apparaît (tunnel Stripe Checkout) qu'une fois activée
  // (FEATURE_STRIPE_CHECKOUT=true ET une clé sk_ fournie). Sinon → mode simulé.
  FEATURE_STRIPE_CHECKOUT: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('TrustPass <noreply@trustpass.dev>'),
  RESERVATION_TTL_SECONDS: z.coerce.number().default(600),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
