import { z } from 'zod';
export declare const RelationCreateSchema: z.ZodObject<{
    charIdSource: z.ZodString;
    charIdTarget: z.ZodString;
    sceneId: z.ZodOptional<z.ZodString>;
    momentId: z.ZodOptional<z.ZodString>;
    summary: z.ZodOptional<z.ZodString>;
    isFavorite: z.ZodOptional<z.ZodBoolean>;
    extraNotes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const RelationUpdateSchema: z.ZodObject<{
    id: z.ZodString;
    charIdSource: z.ZodOptional<z.ZodString>;
    charIdTarget: z.ZodOptional<z.ZodString>;
    sceneId: z.ZodOptional<z.ZodString>;
    momentId: z.ZodOptional<z.ZodString>;
    summary: z.ZodOptional<z.ZodString>;
    isFavorite: z.ZodOptional<z.ZodBoolean>;
    extraNotes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const RelationResponseSchema: z.ZodObject<{
    id: z.ZodString;
    charIdSource: z.ZodString;
    charIdTarget: z.ZodString;
    sceneId: z.ZodNullable<z.ZodString>;
    momentId: z.ZodNullable<z.ZodString>;
    summary: z.ZodNullable<z.ZodString>;
    isFavorite: z.ZodBoolean;
    extraNotes: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export type RelationCreatePayload = z.infer<typeof RelationCreateSchema>;
export type RelationUpdatePayload = z.infer<typeof RelationUpdateSchema>;
export type RelationResponse = z.infer<typeof RelationResponseSchema>;
