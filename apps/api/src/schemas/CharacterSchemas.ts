import { z } from 'zod';
import { UlidSchema } from './SyncSchemas';

export const CharacterSchema = z.object({
  id: UlidSchema,
  storyId: UlidSchema,
  name: z.string().min(1, 'Name cannot be empty'),
  gender: z.string().nullable().optional(),
  race: z.string().nullable().optional(),
  subrace: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  personality: z.string().nullable().optional(),
  motivation: z.string().nullable().optional(),
  qualities: z.string().nullable().optional(),
  weaknesses: z.string().nullable().optional(),
  biography: z.string().nullable().optional(),
  plannedTimeline: z.string().nullable().optional(),
  isFavorite: z.boolean().default(false),
  extraNotes: z.string().nullable().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  version: z.number().int().min(1).default(1),
  isDeleted: z.boolean().default(false),
  deletedAt: z.date().nullable().optional(),
});

export const PartialCharacterSchema = CharacterSchema.partial();
