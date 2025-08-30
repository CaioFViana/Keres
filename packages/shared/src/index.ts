import { z } from 'zod';

// User Schemas
export const UserRegisterSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters long'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export const UserLoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const UserProfileSchema = z.object({
  id: z.string(),
  username: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type UserRegisterPayload = z.infer<typeof UserRegisterSchema>;
export type UserLoginPayload = z.infer<typeof UserLoginSchema>;
export type UserProfileResponse = z.infer<typeof UserProfileSchema>;

// Story Schemas
export const StoryCreateSchema = z.object({
  userId: z.string(),
  title: z.string().min(1, 'Title cannot be empty'),
  summary: z.string().optional(),
  genre: z.string().optional(),
  language: z.string().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
});

export const StoryUpdateSchema = z.object({
  id: z.string(),
  userId: z.string().optional(), // userId should not be updatable in practice, but for now keep it optional
  title: z.string().min(1, 'Name cannot be empty').optional(),
  summary: z.string().optional(),
  genre: z.string().optional(),
  language: z.string().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
});

export const StoryResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  genre: z.string().nullable(),
  language: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type StoryCreatePayload = z.infer<typeof StoryCreateSchema>;
export type StoryUpdatePayload = z.infer<typeof StoryUpdateSchema>;
export type StoryResponse = z.infer<typeof StoryResponseSchema>;

// Character Schemas
export const CharacterCreateSchema = z.object({
  storyId: z.string(),
  name: z.string().min(1, 'Name cannot be empty'),
  gender: z.string().optional(),
  race: z.string().optional(),
  subrace: z.string().optional(),
  personality: z.string().optional(),
  motivation: z.string().optional(),
  qualities: z.string().optional(),
  weaknesses: z.string().optional(),
  biography: z.string().optional(),
  plannedTimeline: z.string().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
});

export const CharacterUpdateSchema = z.object({
  id: z.string(),
  storyId: z.string().optional(), // storyId should not be updatable in practice, but for now keep it optional
  name: z.string().min(1, 'Name cannot be empty').optional(),
  gender: z.string().optional(),
  race: z.string().optional(),
  subrace: z.string().optional(),
  personality: z.string().optional(),
  motivation: z.string().optional(),
  qualities: z.string().optional(),
  weaknesses: z.string().optional(),
  biography: z.string().optional(),
  plannedTimeline: z.string().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
});

export const CharacterResponseSchema = z.object({
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

export type CharacterCreatePayload = z.infer<typeof CharacterCreateSchema>;
export type CharacterUpdatePayload = z.infer<typeof CharacterUpdateSchema>;
export type CharacterResponse = z.infer<typeof CharacterResponseSchema>;

// Chapter Schemas
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

export type ChapterCreatePayload = z.infer<typeof ChapterCreateSchema>;
export type ChapterUpdatePayload = z.infer<typeof ChapterUpdateSchema>;
export type ChapterResponse = z.infer<typeof ChapterResponseSchema>;

// Scene Schemas
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

export type SceneCreatePayload = z.infer<typeof SceneCreateSchema>;
export type SceneUpdatePayload = z.infer<typeof SceneUpdateSchema>;
export type SceneResponse = z.infer<typeof SceneResponseSchema>;

// Moment Schemas
export const MomentCreateSchema = z.object({
  sceneId: z.string(),
  name: z.string().min(1, 'Name cannot be empty'),
  location: z.string().optional(),
  index: z.number().int().min(0, 'Index must be a non-negative integer'),
  summary: z.string().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
});

export const MomentUpdateSchema = z.object({
  id: z.string(),
  sceneId: z.string().optional(), // sceneId should not be updatable in practice
  name: z.string().min(1, 'Name cannot be empty').optional(),
  location: z.string().optional(),
  index: z.number().int().min(0, 'Index must be a non-negative integer').optional(),
  summary: z.string().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
});

export const MomentResponseSchema = z.object({
  id: z.string(),
  sceneId: z.string(),
  name: z.string(),
  location: z.string().nullable(),
  index: z.number().int(),
  summary: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MomentCreatePayload = z.infer<typeof MomentCreateSchema>;
export type MomentUpdatePayload = z.infer<typeof MomentUpdateSchema>;
export type MomentResponse = z.infer<typeof MomentResponseSchema>;

// Location Schemas
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

export type LocationCreatePayload = z.infer<typeof LocationCreateSchema>;
export type LocationUpdatePayload = z.infer<typeof LocationUpdateSchema>;
export type LocationResponse = z.infer<typeof LocationResponseSchema>;

// Gallery Schemas
export const GalleryCreateSchema = z.object({
  storyId: z.string(),
  ownerId: z.string(), // ID of the character/note/location
  imagePath: z.string().url('Invalid image URL'),
  isFile: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
});

export const GalleryUpdateSchema = z.object({
  id: z.string(),
  storyId: z.string().optional(), // storyId should not be updatable in practice
  ownerId: z.string().optional(), // ownerId should not be updatable in practice
  imagePath: z.string().url('Invalid image URL').optional(),
  isFile: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
});

export const GalleryResponseSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  ownerId: z.string(),
  imagePath: z.string(),
  isFile: z.boolean(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type GalleryCreatePayload = z.infer<typeof GalleryCreateSchema>;
export type GalleryUpdatePayload = z.infer<typeof GalleryUpdateSchema>;
export type GalleryResponse = z.infer<typeof GalleryResponseSchema>;

// Relation Schemas
export const RelationCreateSchema = z.object({
  charIdSource: z.string(),
  charIdTarget: z.string(),
  sceneId: z.string().optional(),
  momentId: z.string().optional(),
  summary: z.string().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
});

export const RelationUpdateSchema = z.object({
  id: z.string(),
  charIdSource: z.string().optional(), // Should not be updatable in practice
  charIdTarget: z.string().optional(), // Should not be updatable in practice
  sceneId: z.string().optional(),
  momentId: z.string().optional(),
  summary: z.string().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
});

export const RelationResponseSchema = z.object({
  id: z.string(),
  charIdSource: z.string(),
  charIdTarget: z.string(),
  sceneId: z.string().nullable(),
  momentId: z.string().nullable(),
  summary: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type RelationCreatePayload = z.infer<typeof RelationCreateSchema>;
export type RelationUpdatePayload = z.infer<typeof RelationUpdateSchema>;
export type RelationResponse = z.infer<typeof RelationResponseSchema>;

// CharacterMoment Schemas
export const CharacterMomentCreateSchema = z.object({
  characterId: z.string(),
  momentId: z.string(),
});

// CharacterMoment is a join table, so update is not typically applicable for its core fields.
// If there were additional fields on the join table, an update schema would be defined.
// For now, we'll just define a response schema.

export const CharacterMomentResponseSchema = z.object({
  characterId: z.string(),
  momentId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CharacterMomentCreatePayload = z.infer<typeof CharacterMomentCreateSchema>;
export type CharacterMomentResponse = z.infer<typeof CharacterMomentResponseSchema>;

// CharacterRelation Schemas
export const CharacterRelationCreateSchema = z.object({
  charId1: z.string(),
  charId2: z.string(),
  relationType: z.string().min(1, 'Relation type cannot be empty'),
});

export const CharacterRelationUpdateSchema = z.object({
  id: z.string(),
  charId1: z.string().optional(), // Should not be updatable in practice
  charId2: z.string().optional(), // Should not be updatable in practice
  relationType: z.string().min(1, 'Relation type cannot be empty').optional(),
});

export const CharacterRelationResponseSchema = z.object({
  id: z.string(),
  charId1: z.string(),
  charId2: z.string(),
  relationType: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CharacterRelationCreatePayload = z.infer<typeof CharacterRelationCreateSchema>;
export type CharacterRelationUpdatePayload = z.infer<typeof CharacterRelationUpdateSchema>;
export type CharacterRelationResponse = z.infer<typeof CharacterRelationResponseSchema>;
