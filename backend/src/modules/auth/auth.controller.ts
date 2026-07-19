import type { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { loginSchema, refreshSchema, registerSchema } from './auth.schema.js';
import { prisma } from '../../lib/prisma.js';

export const authController = {
  async register(req: Request, res: Response) {
    const input = registerSchema.parse(req.body);
    const user = await authService.register(input);
    res.status(201).json(user);
  },

  async login(req: Request, res: Response) {
    const input = loginSchema.parse(req.body);
    res.status(200).json(await authService.login(input));
  },

  async refresh(req: Request, res: Response) {
    const { refreshToken } = refreshSchema.parse(req.body);
    res.status(200).json(await authService.refresh(refreshToken));
  },

  async logout(req: Request, res: Response) {
    const { refreshToken } = refreshSchema.parse(req.body);
    await authService.logout(refreshToken);
    res.status(204).send();
  },

  async me(req: Request, res: Response) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: { id: true, email: true, role: true, emailVerifiedAt: true },
    });
    res.status(200).json({ ...user, emailVerified: user.emailVerifiedAt != null });
  },
};
