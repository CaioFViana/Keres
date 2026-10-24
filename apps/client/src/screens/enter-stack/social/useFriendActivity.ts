import type { ChatMessage, SharedStory } from '@keres/shared';
import { useMemo } from 'react';
import type { ServerSelect } from '@/src/db/schemas/servers';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import { friendshipApiService } from '@/src/services/api/FriendshipApiService';
import { messageApi } from '@/src/services/api/MessageApiService';

export interface FriendActivity {
  /** The stories the two work on together; `null` until read, or when the server could not be asked. */
  sharedStories: SharedStory[] | null;
  sharedStoriesFailed: boolean;
  /** The last message of the conversation with this friend, if there is one. */
  lastMessage: ChatMessage | null;
  loading: boolean;
}

type FriendNews = Omit<FriendActivity, 'loading'>;

const NOTHING: FriendNews = {
  sharedStories: null,
  sharedStoriesFailed: false,
  lastMessage: null,
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
  const load = useMemo(
    () =>
      server && friendUserId && isFriend
        ? async (): Promise<FriendNews> => {
            const [shared, conversations] = await Promise.allSettled([
              friendshipApiService.getSharedStories(server, friendUserId),
              messageApi.getConversations(server),
            ]);
            return {
              sharedStories: shared.status === 'fulfilled' ? shared.value : null,
              sharedStoriesFailed: shared.status === 'rejected',
              lastMessage:
                conversations.status === 'fulfilled'
                  ? (conversations.value.find(
                      (conversation) =>
                        conversation.kind === 'direct' && conversation.peerUserId === friendUserId,
                    )?.lastMessage ?? null)
                  : null,
            };
          }
        : null,
    [server, friendUserId, isFriend],
  );
  const { data, loading } = useLoadedResource({
    load,
    initial: NOTHING,
    refreshKey,
    label: 'the friend activity',
    quiet: true,
  });

  return useMemo(() => ({ ...data, loading }), [data, loading]);
}
