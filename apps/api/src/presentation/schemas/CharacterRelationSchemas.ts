import { z } from 'zod';

export const createCharacterRelationSchema = z.object({
  charId1: z.string(),
  charId2: z.string(),
  relationType: z.string().min(1).max(255),
});

export const updateCharacterRelationSchema = z.object({
  id: z.string(),
  charId1: z.string().optional(),
  charId2: z.string().optional(),
  relationType: z.string().min(1).max(255).optional(),
});

export const characterRelationProfileSchema = z.object({
  id: z.string(),
  charId1: z.string(),
  charId2: z.string(),
  relationType: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
