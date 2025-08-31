import { z } from 'zod';
export declare const SceneCreateSchema: z.ZodObject<{
    chapterId: z.ZodString;
    name: z.ZodString;
    index: z.ZodNumber;
    summary: z.ZodOptional<z.ZodString>;
    gap: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodString>;
    isFavorite: z.ZodOptional<z.ZodBoolean>;
    extraNotes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const SceneUpdateSchema: z.ZodObject<{
    id: z.ZodString;
    chapterId: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    index: z.ZodOptional<z.ZodNumber>;
    summary: z.ZodOptional<z.ZodString>;
    gap: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodString>;
    isFavorite: z.ZodOptional<z.ZodBoolean>;
    extraNotes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const SceneResponseSchema: z.ZodObject<{
    id: z.ZodString;
    chapterId: z.ZodString;
    name: z.ZodString;
    index: z.ZodNumber;
    summary: z.ZodNullable<z.ZodString>;
    gap: z.ZodNullable<z.ZodString>;
    duration: z.ZodNullable<z.ZodString>;
    isFavorite: z.ZodBoolean;
    extraNotes: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export type SceneCreatePayload = z.infer<typeof SceneCreateSchema>;
export type SceneUpdatePayload = z.infer<typeof SceneUpdateSchema>;
export type SceneResponse = z.infer<typeof SceneResponseSchema>;
