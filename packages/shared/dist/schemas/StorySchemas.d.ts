import { z } from 'zod';
export declare const StoryCreateSchema: z.ZodObject<{
    userId: z.ZodString;
    type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        linear: "linear";
        branching: "branching";
    }>>>;
    title: z.ZodString;
    summary: z.ZodOptional<z.ZodString>;
    genre: z.ZodOptional<z.ZodString>;
    language: z.ZodOptional<z.ZodString>;
    isFavorite: z.ZodOptional<z.ZodBoolean>;
    extraNotes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const StoryUpdateSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<{
        linear: "linear";
        branching: "branching";
    }>>;
    title: z.ZodOptional<z.ZodString>;
    summary: z.ZodOptional<z.ZodString>;
    genre: z.ZodOptional<z.ZodString>;
    language: z.ZodOptional<z.ZodString>;
    isFavorite: z.ZodOptional<z.ZodBoolean>;
    extraNotes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const StoryResponseSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    type: z.ZodEnum<{
        linear: "linear";
        branching: "branching";
    }>;
    title: z.ZodString;
    summary: z.ZodNullable<z.ZodString>;
    genre: z.ZodNullable<z.ZodString>;
    language: z.ZodNullable<z.ZodString>;
    isFavorite: z.ZodBoolean;
    extraNotes: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export type StoryCreatePayload = z.infer<typeof StoryCreateSchema>;
export type StoryUpdatePayload = z.infer<typeof StoryUpdateSchema>;
export type StoryResponse = z.infer<typeof StoryResponseSchema>;
