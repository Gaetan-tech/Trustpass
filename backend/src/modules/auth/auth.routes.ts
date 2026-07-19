import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { env } from '../../config/env.js';

// Rate limit strict sur l'auth (anti brute-force) — cf. API_CONTRACT §Rate limiting.
// Assoupli hors production pour ne pas gêner le développement et les tests E2E.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'production' ? 20 : 1000,
});

export const authRoutes = Router();

authRoutes.post('/register', authLimiter, asyncHandler(authController.register));
authRoutes.post('/login', authLimiter, asyncHandler(authController.login));
authRoutes.post('/refresh', authLimiter, asyncHandler(authController.refresh));
authRoutes.post('/logout', authenticate, asyncHandler(authController.logout));
authRoutes.get('/me', authenticate, asyncHandler(authController.me));
