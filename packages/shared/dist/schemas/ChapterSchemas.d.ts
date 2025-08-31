import { z } from 'zod';
export declare const ChapterCreateSchema: z.ZodObject<{
    storyId: z.ZodString;
    name: z.ZodString;
    index: z.ZodNumber;
    summary: z.ZodOptional<z.ZodString>;
    isFavorite: z.ZodOptional<z.ZodBoolean>;
    extraNotes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ChapterUpdateSchema: z.ZodObject<{
    id: z.ZodString;
    storyId: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    index: z.ZodOptional<z.ZodNumber>;
    summary: z.ZodOptional<z.ZodString>;
    isFavorite: z.ZodOptional<z.ZodBoolean>;
    extraNotes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ChapterResponseSchema: z.ZodObject<{
    id: z.ZodString;
    storyId: z.ZodString;
    name: z.ZodString;
    index: z.ZodNumber;
    summary: z.ZodNullable<z.ZodString>;
    isFavorite: z.ZodBoolean;
    extraNotes: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export type ChapterCreatePayload = z.infer<typeof ChapterCreateSchema>;
export type ChapterUpdatePayload = z.infer<typeof ChapterUpdateSchema>;
export type ChapterResponse = z.infer<typeof ChapterResponseSchema>;
