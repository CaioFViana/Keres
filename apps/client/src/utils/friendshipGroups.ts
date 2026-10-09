import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import type { ServerSelect } from '../db/schemas/servers';
import type { FriendshipWithServer } from '../services/FriendshipService';

export type FriendshipBucket = 'received' | 'sent' | 'friends' | 'blocked';

export type FriendshipListRow =
  | { type: 'server'; key: string; server: ServerSelect }
  | { type: 'label'; key: string; bucket: FriendshipBucket; count: number }
  | { type: 'empty'; key: string; server: ServerSelect }
  | { type: 'friendship'; key: string; item: FriendshipWithServer };

/**
 * The friendships laid out by server, each server a block of its own. A friendship belongs to a server:
 * the same @tag on two servers is two people, so they are never mixed into one list. Inside a server the
 * ones that wait on the person come first (requests received), then the requests they sent, the friends
 * and the blocked.
 */
export function groupFriendshipsByServer(
  servers: readonly ServerSelect[],
  friendships: readonly FriendshipWithServer[],
): FriendshipListRow[] {
  const rows: FriendshipListRow[] = [];

  for (const server of servers) {
    rows.push({ type: 'server', key: `server:${server.id}`, server });

    const own = friendships.filter((friendship) => friendship.serverId === server.id);
    const pending = own.filter((friendship) => friendship.status === FriendStatus.PENDING);
    const received = pending.filter((friendship) => friendship.receiverId === server.idUser);
    const buckets: [FriendshipBucket, FriendshipWithServer[]][] = [
      ['received', received],
      ['sent', pending.filter((friendship) => !received.includes(friendship))],
      ['friends', own.filter((friendship) => friendship.status === FriendStatus.FRIEND)],
      ['blocked', own.filter((friendship) => friendship.status === FriendStatus.BLACKLISTED)],
    ];

    if (own.length === 0) {
      rows.push({ type: 'empty', key: `empty:${server.id}`, server });
      continue;
    }
    for (const [bucket, items] of buckets) {
      if (items.length === 0) continue;
      rows.push({
        type: 'label',
        key: `label:${server.id}:${bucket}`,
        bucket,
        count: items.length,
      });
      for (const item of items) rows.push({ type: 'friendship', key: item.id, item });
    }
  }
  return rows;
}
