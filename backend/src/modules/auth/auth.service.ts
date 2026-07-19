import argon2 from 'argon2';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { Errors } from '../../lib/errors.js';
import { enqueueEmail } from '../notifications/notifications.service.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

function signAccessToken(userId: string, role: string): string {
  // @ts-expect-error jsonwebtoken accepte les durées "15m" via expiresIn
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_TTL });
}

async function issueRefreshToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(48).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30j
  await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  return `${userId}.${raw}`;
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw Errors.conflict('EMAIL_TAKEN', 'Email already registered');
    const passwordHash = await argon2.hash(input.password);
    const user = await prisma.user.create({
      data: { email: input.email, passwordHash },
      select: { id: true, email: true, role: true },
    });
    await enqueueEmail({ type: 'email_verification', to: user.email });
    return user;
  },

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw Errors.invalidCredentials();
    const ok = await argon2.verify(user.passwordHash, input.password);
    if (!ok) throw Errors.invalidCredentials();
    return {
      accessToken: signAccessToken(user.id, user.role),
      refreshToken: await issueRefreshToken(user.id),
      user: { id: user.id, email: user.email, role: user.role },
    };
  },

  async logout(refreshToken: string) {
    const [userId, raw] = refreshToken.split('.');
    if (!userId || !raw) return; // rien à révoquer
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    await prisma.refreshToken.updateMany({
      where: { userId, tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async refresh(refreshToken: string) {
    const [userId, raw] = refreshToken.split('.');
    if (!userId || !raw) throw Errors.unauthorized('Invalid refresh token');
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    const record = await prisma.refreshToken.findFirst({
      where: { userId, tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!record) throw Errors.unauthorized('Invalid refresh token');
    // Rotation : révoque l'ancien, émet un nouveau couple.
    await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      accessToken: signAccessToken(user.id, user.role),
      refreshToken: await issueRefreshToken(user.id),
    };
  },
};
