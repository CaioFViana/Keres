import { z } from 'zod';
export const SceneCreateSchema = z.object({
    chapterId: z.string(),
    name: z.string().min(1, 'Name cannot be empty'),
    index: z.number().int().min(0, 'Index must be a non-negative integer'),
    summary: z.string().optional(),
    gap: z.string().optional(), // Assuming interval/int is represented as string for now
    duration: z.string().optional(), // Assuming interval/int is represented as string for now
    isFavorite: z.boolean().optional(),
    extraNotes: z.string().optional(),
});
export const SceneUpdateSchema = z.object({
    id: z.string(),
    chapterId: z.string().optional(), // chapterId should not be updatable in practice
    name: z.string().min(1, 'Name cannot be empty').optional(),
    index: z.number().int().min(0, 'Index must be a non-negative integer').optional(),
    summary: z.string().optional(),
    gap: z.string().optional(),
    duration: z.string().optional(),
    isFavorite: z.boolean().optional(),
    extraNotes: z.string().optional(),
});
export const SceneResponseSchema = z.object({
    id: z.string(),
    chapterId: z.string(),
    name: z.string(),
    index: z.number().int(),
    summary: z.string().nullable(),
    gap: z.string().nullable(),
    duration: z.string().nullable(),
    isFavorite: z.boolean(),
    extraNotes: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
});
