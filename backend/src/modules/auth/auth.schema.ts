import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  // À l'inscription, le client choisit son profil : « Acheteur & Vendeur » (buyer,
  // qui peut à la fois acheter et revendre) ou « Organisateur ». Les rôles
  // controller/admin ne sont jamais auto-attribuables (controller = créé par un
  // organisateur ; admin = interne).
  role: z.enum(['buyer', 'organizer']).default('buyer'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
