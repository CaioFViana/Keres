import { z } from 'zod';
import { SharedStoryPermissionTypeEnum } from './StoryPermissionSchemas';

/** An owner inviting a friend to a story; inviting again only changes the offered role. */
export const CreateStoryInvitationSchema = z.object({
  storyId: z.string().ulid(),
  targetUserId: z.string().ulid(),
  permissionType: SharedStoryPermissionTypeEnum,
});
export type CreateStoryInvitationDto = z.infer<typeof CreateStoryInvitationSchema>;

export const StoryInvitationIdParam = z.object({
  invitationId: z.string().ulid(),
});

/**
 * An open invitation as either side sees it. Access is only granted when the invitee accepts; until
 * then the story is neither listed nor downloadable for them. Dates are ISO strings on the wire.
 */
export interface StoryInvitation {
  id: string;
  storyId: string;
  storyTitle: string;
  inviterId: string;
  inviterUsername: string;
  inviteeId: string;
  inviteeUsername: string;
  permissionType: z.infer<typeof SharedStoryPermissionTypeEnum>;
  createdAt: string;
}

/**
 * A story one friend owns and the other collaborates on: what two friends do together. `ownedByMe` is from
 * the point of view of whoever asked; `permissionType` is the role of the one who does not own it.
 */
export interface SharedStory {
  storyId: string;
  title: string;
  ownedByMe: boolean;
  permissionType: z.infer<typeof SharedStoryPermissionTypeEnum>;
}
