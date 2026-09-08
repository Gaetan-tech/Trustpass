import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { trace } from '@opentelemetry/api';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { recordError } from '../lib/metrics.js';

// Gestion d'erreurs centralisée — format uniforme { error: { code, message, details } }.
// Chaque erreur alimente le compteur `trustpass_errors_total` (Prometheus + App Insights)
// labellisé par code + statut, et les 500 attachent l'exception à la trace OTel active
// pour retrouver la pile côté Application Insights.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    recordError('VALIDATION_ERROR', 400);
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: err.flatten() },
    });
    return;
  }

  if (err instanceof AppError) {
    recordError(err.code, err.status);
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details ?? undefined },
    });
    return;
  }

  // Erreur inattendue : trace + métrique pour localiser le problème.
  recordError('INTERNAL_ERROR', 500);
  trace.getActiveSpan()?.recordException(err as Error);
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
};
