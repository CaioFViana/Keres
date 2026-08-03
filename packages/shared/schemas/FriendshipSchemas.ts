import { z } from 'zod';
import { FriendStatus } from '../metadata/FriendStatus';

export const FriendshipSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  receiverId: z.string(),
  status: z.enum([FriendStatus.PENDING, FriendStatus.FRIEND, FriendStatus.BLACKLISTED]).default(FriendStatus.PENDING),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}).refine(data => data.senderId !== data.receiverId, {
  message: 'senderId and receiverId cannot be the same',
  path: ['senderId', 'receiverId'],
});

export type Friendship = z.infer<typeof FriendshipSchema>;


