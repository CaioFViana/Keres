import { z } from 'zod';
export const CharacterRelationCreateSchema = z.object({
    charId1: z.string(),
    charId2: z.string(),
    relationType: z.string().min(1, 'Relation type cannot be empty'),
});
export const CharacterRelationUpdateSchema = z.object({
    id: z.string(),
    charId1: z.string().optional(), // Should not be updatable in practice
    charId2: z.string().optional(), // Should not be updatable in practice
    relationType: z.string().min(1, 'Relation type cannot be empty').optional(),
});
export const CharacterRelationResponseSchema = z.object({
    id: z.string(),
    charId1: z.string(),
    charId2: z.string(),
    relationType: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
});
