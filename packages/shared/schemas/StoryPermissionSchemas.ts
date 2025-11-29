import { z } from 'zod';

export const SharedStoryPermissionTypeEnum = z.enum(['reader', 'writer']); // New shared enum

export const CreateStoryPermissionSchema = z.object({
  storyId: z.string().ulid(),
  targetUserId: z.string().ulid(),
  permissionType: SharedStoryPermissionTypeEnum, // Use the shared enum
});

export const UpdateStoryPermissionSchema = z.object({
  permissionType: SharedStoryPermissionTypeEnum, // Use the shared enum
});

export const StoryPermissionIdParam = z.object({
  permissionId: z.string().ulid(),
});

export const StoryIdParam = z.object({
  storyId: z.string().ulid(),
});

export const StoryAndTargetUserParams = z.object({
  storyId: z.string().ulid(),
  targetUserId: z.string().ulid(),
});

export type CreateStoryPermissionDto = z.infer<typeof CreateStoryPermissionSchema>;
export type UpdateStoryPermissionDto = z.infer<typeof UpdateStoryPermissionSchema>;
