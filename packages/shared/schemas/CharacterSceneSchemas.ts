import { z } from 'zod';

export const CharacterSceneSchema = z.object({
  id: z.string(), // Add the ID field
  characterId: z.string(),
  storyId: z.string(),
  sceneId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateCharacterSceneDataSchema = CharacterSceneSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  characterId: z.string().min(1, 'Character ID cannot be empty'),
  sceneId: z.string().min(1, 'Scene ID cannot be empty'),
});

export const PartialCharacterSceneSchema = CreateCharacterSceneDataSchema.partial();

export type CreateCharacterSceneDataType = z.infer<typeof CreateCharacterSceneDataSchema>;
export type CharacterSceneType = z.infer<typeof CharacterSceneSchema>;
export type PartialCharacterSceneType = z.infer<typeof PartialCharacterSceneSchema>;
