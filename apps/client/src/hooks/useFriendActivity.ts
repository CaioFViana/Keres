import type { ChatMessage, SharedStory } from '@keres/shared';
import { useEffect, useState } from 'react';
import type { ServerSelect } from '../db/schemas/servers';
import { friendshipApiService } from '../services/FriendshipApiService';
import { messageApi } from '../services/MessageApiService';

export interface FriendActivity {
  /** The stories the two work on together; `null` until read, or when the server could not be asked. */
  sharedStories: SharedStory[] | null;
  sharedStoriesFailed: boolean;
  /** The last message of the conversation with this friend, if there is one. */
  lastMessage: ChatMessage | null;
  loading: boolean;
}

const NOTHING: FriendActivity = {
  sharedStories: null,
  sharedStoriesFailed: false,
  lastMessage: null,
  loading: false,
};

/**
 * What a friend and the person have going on, read from the friend's server: the stories they work on
 * together and how the conversation last ended. Each is asked on its own, so a server that answers one
 * and not the other still shows what it can. Read again whenever `refreshKey` changes - the screen
 * passes the loaded friendship, so coming back to it brings fresh news.
 *
 * Only for a friend: access and messages exist only between friends, and for anyone else there is
 * nothing to ask.
 */
export function useFriendActivity(
  server: ServerSelect | null,
  friendUserId: string | null,
  isFriend: boolean,
  refreshKey: unknown,
): FriendActivity {
  const [activity, setActivity] = useState<FriendActivity>(NOTHING);

  useEffect(() => {
    if (!server || !friendUserId || !isFriend) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing what belongs to a friend who no longer applies.
      setActivity(NOTHING);
      return undefined;
    }
    let cancelled = false;
    setActivity((current) => ({ ...current, loading: true }));
    void (async () => {
      const [shared, conversations] = await Promise.allSettled([
        friendshipApiService.getSharedStories(server, friendUserId),
        messageApi.getConversations(server),
      ]);
      if (cancelled) return;
      setActivity({
        sharedStories: shared.status === 'fulfilled' ? shared.value : null,
        sharedStoriesFailed: shared.status === 'rejected',
        lastMessage:
          conversations.status === 'fulfilled'
            ? (conversations.value.find(
                (conversation) =>
                  conversation.kind === 'direct' && conversation.peerUserId === friendUserId,
              )?.lastMessage ?? null)
            : null,
        loading: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [server, friendUserId, isFriend, refreshKey]);

  return activity;
}
