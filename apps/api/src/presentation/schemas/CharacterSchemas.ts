import { z } from 'zod';

export const createCharacterSchema = z.object({
  storyId: z.string(),
  name: z.string().min(1).max(255),
  gender: z.string().nullable().optional(),
  race: z.string().nullable().optional(),
  subrace: z.string().nullable().optional(),
  personality: z.string().nullable().optional(),
  motivation: z.string().nullable().optional(),
  qualities: z.string().nullable().optional(),
  weaknesses: z.string().nullable().optional(),
  biography: z.string().nullable().optional(),
  plannedTimeline: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
});

export const updateCharacterSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string().min(1).max(255).optional(),
  gender: z.string().nullable().optional(),
  race: z.string().nullable().optional(),
  subrace: z.string().nullable().optional(),
  personality: z.string().nullable().optional(),
  motivation: z.string().nullable().optional(),
  qualities: z.string().nullable().optional(),
  weaknesses: z.string().nullable().optional(),
  biography: z.string().nullable().optional(),
  plannedTimeline: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
});

export const characterProfileSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string(),
  gender: z.string().nullable(),
  race: z.string().nullable(),
  subrace: z.string().nullable(),
  personality: z.string().nullable(),
  motivation: z.string().nullable(),
  qualities: z.string().nullable(),
  weaknesses: z.string().nullable(),
  biography: z.string().nullable(),
  plannedTimeline: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
