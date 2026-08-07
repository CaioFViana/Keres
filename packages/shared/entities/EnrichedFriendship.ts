import { Friendship } from '../schemas/FriendshipSchemas';

// createdAt/updatedAt arrive as ISO strings over HTTP/JSON, not Date instances -
// Friendship's Zod-derived Date typing only holds locally, never on the wire.
export interface EnrichedFriendship extends Omit<Friendship, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
  friendUsername: string;
  otherUserId: string;
  /** The other user's `@tag` - distinct from `friendUsername` (display name), needed since the
   *  client used to have no way to show it and fell back to showing the *current* user's own
   *  tag instead (`ServerSelect.tag`), which was always wrong. */
  otherUserTag: string;
  /** The other user's chosen avatar/bio - denormalized here so the friend list/avatar render
   *  without a separate per-friend fetch, same reasoning as `friendUsername`. */
  otherUserAvatarColor: string | null;
  otherUserAvatarIcon: string | null;
  otherUserBio: string | null;
}
