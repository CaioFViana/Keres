import { z } from 'zod';
export declare const LocationCreateSchema: z.ZodObject<{
    storyId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    climate: z.ZodOptional<z.ZodString>;
    culture: z.ZodOptional<z.ZodString>;
    politics: z.ZodOptional<z.ZodString>;
    isFavorite: z.ZodOptional<z.ZodBoolean>;
    extraNotes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const LocationUpdateSchema: z.ZodObject<{
    id: z.ZodString;
    storyId: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    climate: z.ZodOptional<z.ZodString>;
    culture: z.ZodOptional<z.ZodString>;
    politics: z.ZodOptional<z.ZodString>;
    isFavorite: z.ZodOptional<z.ZodBoolean>;
    extraNotes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const LocationResponseSchema: z.ZodObject<{
    id: z.ZodString;
    storyId: z.ZodString;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    climate: z.ZodNullable<z.ZodString>;
    culture: z.ZodNullable<z.ZodString>;
    politics: z.ZodNullable<z.ZodString>;
    isFavorite: z.ZodBoolean;
    extraNotes: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export type LocationCreatePayload = z.infer<typeof LocationCreateSchema>;
export type LocationUpdatePayload = z.infer<typeof LocationUpdateSchema>;
export type LocationResponse = z.infer<typeof LocationResponseSchema>;
