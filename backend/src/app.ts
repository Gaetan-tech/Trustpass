import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { apiRouter } from './routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { metricsMiddleware } from './lib/metrics.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  // Journalisation structurée avec propagation d'un requestId de bout en bout
  // (repris de l'en-tête entrant ou généré), renvoyé aussi au client (BLOC 4, §3.2.3).
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const existing = (req.headers['x-request-id'] as string) || randomUUID();
        res.setHeader('X-Request-Id', existing);
        return existing;
      },
    }),
  );
  app.use(metricsMiddleware);

  // Le webhook Stripe a besoin du corps brut pour vérifier la signature :
  // on monte le raw body AVANT le parser JSON global.
  app.use('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }));
  app.use(express.json());

  // Health / readiness (non versionnés).
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/ready', (_req, res) => res.json({ status: 'ready' }));

  // La racine renvoie vers la documentation interactive : ouvrir l'URL Azure
  // de l'API affiche directement la description de l'API (Swagger UI).
  app.get('/', (_req, res) => res.redirect('/api/v1/docs'));

  app.use('/api/v1', apiRouter);

  app.use(errorHandler);
  return app;
}
