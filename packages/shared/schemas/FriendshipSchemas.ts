import { z } from 'zod';
import { FriendStatus } from '../metadata/FriendStatus';

export const FriendshipSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  receiverId: z.string(),
  status: z.enum([FriendStatus.PENDING, FriendStatus.FRIEND, FriendStatus.BLACKLISTED]).default(FriendStatus.PENDING),
  /**
   * Who actually issued the blacklist - `null` unless `status === BLACKLISTED`. Distinct from
   * `senderId`/`receiverId`, which only ever record who sent the *original friend request* and
   * say nothing about who later blocked whom. Without this, either side of a blacklisted
   * relationship could unblock it, including the person who got blocked.
   */
  blockedById: z.string().nullable().default(null),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}).refine(data => data.senderId !== data.receiverId, {
  message: 'senderId and receiverId cannot be the same',
  path: ['senderId', 'receiverId'],
});

export type Friendship = z.infer<typeof FriendshipSchema>;


