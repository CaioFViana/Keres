import { z } from 'zod';
import { FriendStatus } from '../metadata/FriendStatus';

export const UserTargetIdParam = z.object({
  targetUserId: z.string().ulid(),
});

export const UpdateFriendshipStatusSchema = z.object({
  status: z.enum([FriendStatus.FRIEND, FriendStatus.BLACKLISTED]),
});