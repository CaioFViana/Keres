import { z } from 'zod';
export const LocationCreateSchema = z.object({
    storyId: z.string(),
    name: z.string().min(1, 'Name cannot be empty'),
    description: z.string().optional(),
    climate: z.string().optional(),
    culture: z.string().optional(),
    politics: z.string().optional(),
    isFavorite: z.boolean().optional(),
    extraNotes: z.string().optional(),
});
export const LocationUpdateSchema = z.object({
    id: z.string(),
    storyId: z.string().optional(), // storyId should not be updatable in practice
    name: z.string().min(1, 'Name cannot be empty').optional(),
    description: z.string().optional(),
    climate: z.string().optional(),
    culture: z.string().optional(),
    politics: z.string().optional(),
    isFavorite: z.boolean().optional(),
    extraNotes: z.string().optional(),
});
export const LocationResponseSchema = z.object({
    id: z.string(),
    storyId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    climate: z.string().nullable(),
    culture: z.string().nullable(),
    politics: z.string().nullable(),
    isFavorite: z.boolean(),
    extraNotes: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
});
