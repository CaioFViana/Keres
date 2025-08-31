import { z } from 'zod';
export const ChapterCreateSchema = z.object({
    storyId: z.string(),
    name: z.string().min(1, 'Name cannot be empty'),
    index: z.number().int().min(0, 'Index must be a non-negative integer'),
    summary: z.string().optional(),
    isFavorite: z.boolean().optional(),
    extraNotes: z.string().optional(),
});
export const ChapterUpdateSchema = z.object({
    id: z.string(),
    storyId: z.string().optional(), // storyId should not be updatable in practice, but for now keep it optional
    name: z.string().min(1, 'Name cannot be empty').optional(),
    index: z.number().int().min(0, 'Index must be a non-negative integer').optional(),
    summary: z.string().optional(),
    isFavorite: z.boolean().optional(),
    extraNotes: z.string().optional(),
});
export const ChapterResponseSchema = z.object({
    id: z.string(),
    storyId: z.string(),
    name: z.string(),
    index: z.number().int(),
    summary: z.string().nullable(),
    isFavorite: z.boolean(),
    extraNotes: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
});
