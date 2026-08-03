import { UlidSchema } from '../schemas/SyncSchemas'; // Adjusted path
import { z } from 'zod';

export const CharacterSchema = z.object({
  id: UlidSchema,
  storyId: UlidSchema,
  name: z.string().min(1, 'Name cannot be empty'),
  title: z.string().nullable().optional(),
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
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
  version: z.number().int().min(1).default(1),
  isDeleted: z.boolean().default(false),
  deletedAt: z.coerce.date().nullable().optional(),
});

export const CreateCharacterDataSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty'),
  title: z.string().nullable().optional(),
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
});

export const PartialCharacterSchema = CharacterSchema.partial();
