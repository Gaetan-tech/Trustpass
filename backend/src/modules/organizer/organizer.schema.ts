import { z } from 'zod';

// Création d'un compte contrôleur par un organisateur (email + mot de passe).
export const createControllerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export type CreateControllerInput = z.infer<typeof createControllerSchema>;
