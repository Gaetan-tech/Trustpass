import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { apiRouter } from './routes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(pinoHttp({ logger }));

  // Le webhook Stripe a besoin du corps brut pour vérifier la signature :
  // on monte le raw body AVANT le parser JSON global.
  app.use('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }));
  app.use(express.json());

  // Health / readiness (non versionnés).
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/ready', (_req, res) => res.json({ status: 'ready' }));

  app.use('/api/v1', apiRouter);

  app.use(errorHandler);
  return app;
}
