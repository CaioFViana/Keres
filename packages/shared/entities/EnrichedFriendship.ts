import { Friendship } from '../schemas/FriendshipSchemas';

export interface EnrichedFriendship extends Friendship {
  friendUsername: string;
  otherUserId: string;
}
