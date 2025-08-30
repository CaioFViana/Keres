import { z } from 'zod';

export const createCharacterMomentSchema = z.object({
  characterId: z.string(),
  momentId: z.string(),
});

export const characterMomentProfileSchema = z.object({
  characterId: z.string(),
  momentId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
