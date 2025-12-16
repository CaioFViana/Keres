import { z } from 'zod';
import { FriendStatus } from '../metadata/FriendStatus';

export const FriendshipSchema = z.object({
  id: z.string(),
  user1Id: z.string(),
  user2Id: z.string(),
  status: z.enum([FriendStatus.PENDING, FriendStatus.FRIEND, FriendStatus.BLACKLISTED]).default(FriendStatus.PENDING),
  createdAt: z.date(),
  updatedAt: z.date(),
}).refine(data => data.user1Id !== data.user2Id, {
  message: 'user1Id and user2Id cannot be the same',
  path: ['user1Id', 'user2Id'],
});

export type Friendship = z.infer<typeof FriendshipSchema>;
