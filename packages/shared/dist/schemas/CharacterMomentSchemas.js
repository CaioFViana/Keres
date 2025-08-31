import { z } from 'zod';
export const CharacterMomentCreateSchema = z.object({
    characterId: z.string(),
    momentId: z.string(),
});
// CharacterMoment is a join table, so update is not typically applicable for its core fields.
// If there were additional fields on the join table, an update schema would be defined.
// For now, we'll just define a response schema.
export const CharacterMomentResponseSchema = z.object({
    characterId: z.string(),
    momentId: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
});
