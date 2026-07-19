import type { NextFunction, Request, RequestHandler, Response } from 'express';

// Enrobe un handler async pour router les rejets vers le errorHandler.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
