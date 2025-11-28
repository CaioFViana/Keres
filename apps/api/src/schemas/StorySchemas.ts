import { UlidSchema } from '@keres/shared';
import { z } from 'zod';

export const StoryTypeSchema = z.enum(['linear', 'branching']);

// Schema for client-provided input during story creation
export const StoryCreateInputSchema = z.object({
  id: UlidSchema, // Client provides ULID
  title: z.string().min(1, 'Title cannot be empty'),
  type: StoryTypeSchema,
  description: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  isFavorite: z.boolean().default(false),
  extraNotes: z.string().nullable().optional(),
  theme: z.string().nullable().optional(),
});

// Schema for the 'data' payload when creating a story via sync
export const CreateStoryDataSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty'),
  type: StoryTypeSchema,
  description: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  isFavorite: z.boolean().default(false),
  extraNotes: z.string().nullable().optional(),
  theme: z.string().nullable().optional(),
});

// Full Story Schema, including server-managed fields like userId
export const StorySchema = StoryCreateInputSchema.extend({
  userId: UlidSchema, // userId is set by the server
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  version: z.number().int().min(1).default(1),
  isDeleted: z.boolean().default(false),
  deletedAt: z.date().nullable().optional(),
});

export const PartialStorySchema = StorySchema.partial();
