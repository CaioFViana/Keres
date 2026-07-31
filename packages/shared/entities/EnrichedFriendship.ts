import { Friendship } from '../schemas/FriendshipSchemas';

// createdAt/updatedAt arrive as ISO strings over HTTP/JSON, not Date instances -
// Friendship's Zod-derived Date typing only holds locally, never on the wire.
export interface EnrichedFriendship extends Omit<Friendship, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
  friendUsername: string;
  otherUserId: string;
}
