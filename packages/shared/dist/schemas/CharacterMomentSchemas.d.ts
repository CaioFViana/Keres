import { z } from 'zod';
export declare const CharacterMomentCreateSchema: z.ZodObject<{
    characterId: z.ZodString;
    momentId: z.ZodString;
}, z.core.$strip>;
export declare const CharacterMomentResponseSchema: z.ZodObject<{
    characterId: z.ZodString;
    momentId: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export type CharacterMomentCreatePayload = z.infer<typeof CharacterMomentCreateSchema>;
export type CharacterMomentResponse = z.infer<typeof CharacterMomentResponseSchema>;
