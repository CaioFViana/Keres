import { z } from 'zod';
export declare const MomentCreateSchema: z.ZodObject<{
    sceneId: z.ZodString;
    name: z.ZodString;
    location: z.ZodOptional<z.ZodString>;
    index: z.ZodNumber;
    summary: z.ZodOptional<z.ZodString>;
    isFavorite: z.ZodOptional<z.ZodBoolean>;
    extraNotes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const MomentUpdateSchema: z.ZodObject<{
    id: z.ZodString;
    sceneId: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    index: z.ZodOptional<z.ZodNumber>;
    summary: z.ZodOptional<z.ZodString>;
    isFavorite: z.ZodOptional<z.ZodBoolean>;
    extraNotes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const MomentResponseSchema: z.ZodObject<{
    id: z.ZodString;
    sceneId: z.ZodString;
    name: z.ZodString;
    location: z.ZodNullable<z.ZodString>;
    index: z.ZodNumber;
    summary: z.ZodNullable<z.ZodString>;
    isFavorite: z.ZodBoolean;
    extraNotes: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export type MomentCreatePayload = z.infer<typeof MomentCreateSchema>;
export type MomentUpdatePayload = z.infer<typeof MomentUpdateSchema>;
export type MomentResponse = z.infer<typeof MomentResponseSchema>;
