import { z } from 'zod';

export const CharacterRelationSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  character1Id: z.string(),
  character2Id: z.string(),
  relationType: z.string().min(1, "Relation type cannot be empty"),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateCharacterRelationDataSchema = CharacterRelationSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  character1Id: z.string().min(1, "Character 1 ID cannot be empty"),
  character2Id: z.string().min(1, "Character 2 ID cannot be empty"),
  relationType: z.string().min(1, "Relation type cannot be empty"),
}).refine(data => data.character1Id !== data.character2Id, {
  message: "Character 1 ID and Character 2 ID cannot be identical.",
  path: ["character2Id"], // This will associate the error with character2Id field
});

export const PartialCharacterRelationSchema = CharacterRelationSchema.partial().refine(data => {
  if (data.character1Id && data.character2Id) {
    return data.character1Id !== data.character2Id;
  }
  return true; // If only one or neither is present, defer this check to full schema or handler
}, {
  message: "Character 1 ID and Character 2 ID cannot be identical.",
  path: ["character2Id"],
});

export type CreateCharacterRelationDataType = z.infer<typeof CreateCharacterRelationDataSchema>;
export type CharacterRelationType = z.infer<typeof CharacterRelationSchema>;
export type PartialCharacterRelationType = z.infer<typeof PartialCharacterRelationSchema>;
