import { z } from 'zod';
import { storyPermissionTypeEnum } from '../db/schema';

export const CreateStoryPermissionSchema = z.object({
  storyId: z.string().ulid(),
  targetUserId: z.string().ulid(),
  permissionType: z.enum(storyPermissionTypeEnum.enumValues),
});

export const UpdateStoryPermissionSchema = z.object({
  permissionType: z.enum(storyPermissionTypeEnum.enumValues),
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
