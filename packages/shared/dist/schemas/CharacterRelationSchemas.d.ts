import { z } from 'zod';
export declare const CharacterRelationCreateSchema: z.ZodObject<{
    charId1: z.ZodString;
    charId2: z.ZodString;
    relationType: z.ZodString;
}, z.core.$strip>;
export declare const CharacterRelationUpdateSchema: z.ZodObject<{
    id: z.ZodString;
    charId1: z.ZodOptional<z.ZodString>;
    charId2: z.ZodOptional<z.ZodString>;
    relationType: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const CharacterRelationResponseSchema: z.ZodObject<{
    id: z.ZodString;
    charId1: z.ZodString;
    charId2: z.ZodString;
    relationType: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export type CharacterRelationCreatePayload = z.infer<typeof CharacterRelationCreateSchema>;
export type CharacterRelationUpdatePayload = z.infer<typeof CharacterRelationUpdateSchema>;
export type CharacterRelationResponse = z.infer<typeof CharacterRelationResponseSchema>;
