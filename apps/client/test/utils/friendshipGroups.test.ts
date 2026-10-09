import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import type { ServerSelect } from '../../src/db/schemas/servers';
import type { FriendshipWithServer } from '../../src/services/FriendshipService';
import { groupFriendshipsByServer } from '../../src/utils/friendshipGroups';

const server = (id: string, idUser: string) =>
  ({ id, idUser, name: id }) as unknown as ServerSelect;
const friendship = (over: Partial<FriendshipWithServer>) =>
  ({
    id: 'f',
    serverId: 'a',
    status: FriendStatus.FRIEND,
    senderId: 'x',
    receiverId: 'y',
    ...over,
  }) as unknown as FriendshipWithServer;

const shape = (rows: ReturnType<typeof groupFriendshipsByServer>) =>
  rows.map((row) =>
    row.type === 'server'
      ? `server:${row.server.id}`
      : row.type === 'label'
        ? `${row.bucket}:${row.count}`
        : row.type === 'empty'
          ? `empty:${row.server.id}`
          : `item:${row.item.id}`,
  );

describe('groupFriendshipsByServer', () => {
  it('lays each server out as a block of its own, in the order of the servers', () => {
    const rows = groupFriendshipsByServer(
      [server('a', 'me-a'), server('b', 'me-b')],
      [
        friendship({ id: '1', serverId: 'b' }),
        friendship({ id: '2', serverId: 'a' }),
        friendship({ id: '3', serverId: 'b' }),
      ],
    );

    expect(shape(rows)).toEqual([
      'server:a',
      'friends:1',
      'item:2',
      'server:b',
      'friends:2',
      'item:1',
      'item:3',
    ]);
  });

  it('puts what waits on the person first, then sent requests, friends and blocked', () => {
    const rows = groupFriendshipsByServer(
      [server('a', 'me')],
      [
        friendship({ id: 'blocked', status: FriendStatus.BLACKLISTED }),
        friendship({ id: 'friend' }),
        friendship({
          id: 'sent',
          status: FriendStatus.PENDING,
          senderId: 'me',
          receiverId: 'them',
        }),
        friendship({
          id: 'received',
          status: FriendStatus.PENDING,
          senderId: 'them',
          receiverId: 'me',
        }),
      ],
    );

    expect(shape(rows)).toEqual([
      'server:a',
      'received:1',
      'item:received',
      'sent:1',
      'item:sent',
      'friends:1',
      'item:friend',
      'blocked:1',
      'item:blocked',
    ]);
  });

  it('tells a request received from one sent by the person on that server, not on another', () => {
    const rows = groupFriendshipsByServer(
      [server('a', 'me-a'), server('b', 'me-b')],
      [
        // The same ids, read on each server as the person who is signed in there.
        friendship({
          id: 'on-a',
          serverId: 'a',
          status: FriendStatus.PENDING,
          senderId: 'me-b',
          receiverId: 'me-a',
        }),
        friendship({
          id: 'on-b',
          serverId: 'b',
          status: FriendStatus.PENDING,
          senderId: 'me-b',
          receiverId: 'me-a',
        }),
      ],
    );

    expect(shape(rows)).toEqual([
      'server:a',
      'received:1',
      'item:on-a',
      'server:b',
      'sent:1',
      'item:on-b',
    ]);
  });

  it('keeps a server with no friendships in the list, marked empty', () => {
    expect(shape(groupFriendshipsByServer([server('a', 'me')], []))).toEqual([
      'server:a',
      'empty:a',
    ]);
  });

  it('is empty without servers', () => {
    expect(groupFriendshipsByServer([], [friendship({})])).toEqual([]);
  });
});
