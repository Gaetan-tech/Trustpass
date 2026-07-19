import type { RequestHandler } from 'express';

// Placeholder pour les endpoints scaffoldés non encore implémentés (M3+).
export const notImplemented =
  (story: string): RequestHandler =>
  (_req, res) => {
    res.status(501).json({
      error: { code: 'NOT_IMPLEMENTED', message: `Endpoint à implémenter (${story})` },
    });
  };
