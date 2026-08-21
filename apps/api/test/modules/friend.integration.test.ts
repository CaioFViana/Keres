import { beforeEach, describe, expect, it } from 'vitest';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let ana: TestUser;
let bia: TestUser;

const sendRequest = (from: TestUser, to: TestUser) =>
  request('POST', `/friend/request/${to.userId}`, { token: from.token });
const accept = (who: TestUser, sender: TestUser) =>
  request('PUT', `/friend/accept/${sender.userId}`, { token: who.token });
const decline = (who: TestUser, sender: TestUser) =>
  request('DELETE', `/friend/decline/${sender.userId}`, { token: who.token });
const cancel = (who: TestUser, target: TestUser) =>
  request('DELETE', `/friend/request/${target.userId}`, { token: who.token });
const blacklist = (who: TestUser, target: TestUser) =>
  request('POST', `/friend/blacklist/${target.userId}`, { token: who.token });
const unblacklist = (who: TestUser, target: TestUser) =>
  request('DELETE', `/friend/blacklist/${target.userId}`, { token: who.token });
const unfriend = (who: TestUser, target: TestUser) =>
  request('DELETE', `/friend/unfriend/${target.userId}`, { token: who.token });
const listFriendships = (who: TestUser) => request('GET', '/friend/', { token: who.token });

const statusOf = async (who: TestUser, otherId: string) => {
  const { data } = await listFriendships(who);
  return data.find((row: any) => row.senderId === otherId || row.receiverId === otherId)?.status;
};

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  bia = await registerUser('bia');
});

/**
 * Toda recusa aqui é uma decisão da aplicação com mensagem que o usuário precisa ler ("vocês
 * já são amigos", "existe um pedido pendente"). Os status concretos estão fixados de
 * propósito: antes desta suíte, todas caíam no fallback do `onError` e chegavam ao cliente
 * como 500 "Internal server error.", indistinguíveis de uma falha de verdade.
 */
describe('sending a friend request', () => {
  it('creates a pending relation', async () => {
    const { status } = await sendRequest(ana, bia);

    expect(status).toBe(200);
    expect(await statusOf(ana, bia.userId)).toBe('pending');
  });

  it('shows up as pending for the person who received it', async () => {
    await sendRequest(ana, bia);

    expect(await statusOf(bia, ana.userId)).toBe('pending');
  });

  it('refuses a second request to the same person', async () => {
    await sendRequest(ana, bia);

    const { status, data } = await sendRequest(ana, bia);

    expect(status).toBe(409);
    expect(data.message).toMatch(/already pending/i);
  });

  it('refuses a request in the other direction while one is pending', async () => {
    await sendRequest(ana, bia);

    const { status, data } = await sendRequest(bia, ana);

    expect(status).toBe(409);
    expect(data.message).toMatch(/pending friend request from this user/i);
  });

  /**
   * The sequential test above only proves the checks work when one request's write is already
   * committed before the other's checks run. Two opposite-direction requests fired at the same
   * time can both read "no existing row" before either commits - the unique constraint on
   * (senderId, receiverId) doesn't help here since A→B and B→A are different rows. An advisory
   * lock, keyed by the pair sorted so both directions contend for the same lock, serializes
   * this; without it, both could succeed and leave two pending rows for the same pair instead
   * of exactly one.
   */
  it('resolves a race between opposite-direction requests into exactly one pending relation', async () => {
    const [anaToBia, biaToAna] = await Promise.all([sendRequest(ana, bia), sendRequest(bia, ana)]);

    const statuses = [anaToBia.status, biaToAna.status].sort();
    expect(statuses).toEqual([200, 409]);

    const { data } = await listFriendships(ana);
    expect(data).toHaveLength(1);
    expect(data[0].status).toBe('pending');
  });

  it('refuses a request to somebody who is already a friend', async () => {
    await sendRequest(ana, bia);
    await accept(bia, ana);

    const { status, data } = await sendRequest(ana, bia);

    expect(status).toBe(409);
    expect(data.message).toBe('Already friends.');
  });

  it('refuses a request across a block', async () => {
    await blacklist(bia, ana);

    const { status, data } = await sendRequest(ana, bia);

    expect(status).toBe(403);
    expect(data.message).toMatch(/blacklisted/i);
  });

  it('refuses a request to yourself', async () => {
    const { status, data } = await sendRequest(ana, ana);

    expect(status).toBe(400);
    expect(data.message).toBe('Cannot send friend request to self.');
  });

  it('refuses a request to somebody who does not exist', async () => {
    const { status, data } = await request('POST', `/friend/request/${newId()}`, {
      token: ana.token,
    });

    expect(status).toBe(404);
    expect(data.message).toMatch(/not found/i);
  });

  it('requires a session', async () => {
    const { status } = await request('POST', `/friend/request/${bia.userId}`);

    expect(status).toBe(401);
  });
});

describe('accepting a friend request', () => {
  it('turns the relation into a friendship for both sides', async () => {
    await sendRequest(ana, bia);

    const { status } = await accept(bia, ana);

    expect(status).toBe(200);
    expect(await statusOf(ana, bia.userId)).toBe('friend');
    expect(await statusOf(bia, ana.userId)).toBe('friend');
  });

  it('refuses to let the sender accept their own request', async () => {
    await sendRequest(ana, bia);

    const { status } = await accept(ana, bia);

    expect(status).toBe(404);
    expect(await statusOf(ana, bia.userId)).toBe('pending');
  });

  it('refuses to accept a request that was never sent', async () => {
    const { status, data } = await accept(bia, ana);

    expect(status).toBe(404);
    expect(data.message).toMatch(/not found or not pending/i);
  });

  it('requires a session', async () => {
    await sendRequest(ana, bia);

    const { status } = await request('PUT', `/friend/accept/${ana.userId}`);

    expect(status).toBe(401);
  });
});

describe('declining and cancelling', () => {
  it('lets the receiver decline, clearing the pending relation', async () => {
    await sendRequest(ana, bia);

    const { status } = await decline(bia, ana);

    expect(status).toBe(200);
    expect(await statusOf(ana, bia.userId)).toBeUndefined();
  });

  it('lets the sender cancel their own request', async () => {
    await sendRequest(ana, bia);

    const { status } = await cancel(ana, bia);

    expect(status).toBe(200);
    expect(await statusOf(bia, ana.userId)).toBeUndefined();
  });

  it('allows a fresh request after a decline', async () => {
    await sendRequest(ana, bia);
    await decline(bia, ana);

    const { status } = await sendRequest(ana, bia);

    expect(status).toBe(200);
  });

  it('refuses to decline a request that does not exist', async () => {
    const { status } = await decline(bia, ana);

    expect(status).toBe(404);
  });

  it('refuses to cancel a request that was never sent', async () => {
    const { status } = await cancel(ana, bia);

    expect(status).toBe(404);
  });
});

describe('unfriending', () => {
  it('removes the friendship from both sides', async () => {
    await sendRequest(ana, bia);
    await accept(bia, ana);

    const { status } = await unfriend(ana, bia);

    expect(status).toBe(200);
    expect(await statusOf(ana, bia.userId)).toBeUndefined();
    expect(await statusOf(bia, ana.userId)).toBeUndefined();
  });

  it('works from either side of the friendship', async () => {
    await sendRequest(ana, bia);
    await accept(bia, ana);

    const { status } = await unfriend(bia, ana);

    expect(status).toBe(200);
  });

  it('refuses to unfriend somebody who is not a friend', async () => {
    const { status, data } = await unfriend(ana, bia);

    expect(status).toBe(409);
    expect(data.message).toBe('Users are not friends.');
  });

  it('refuses to unfriend somebody who only has a pending request', async () => {
    await sendRequest(ana, bia);

    const { status } = await unfriend(ana, bia);

    expect(status).toBe(409);
    expect(await statusOf(ana, bia.userId)).toBe('pending');
  });
});

describe('blacklisting', () => {
  it('blocks a user with no previous relation', async () => {
    const { status } = await blacklist(ana, bia);

    expect(status).toBe(200);
    expect(await statusOf(ana, bia.userId)).toBe('blacklisted');
  });

  it('replaces an existing friendship with a block', async () => {
    await sendRequest(ana, bia);
    await accept(bia, ana);

    await blacklist(ana, bia);

    expect(await statusOf(ana, bia.userId)).toBe('blacklisted');
  });

  it('is idempotent', async () => {
    await blacklist(ana, bia);

    const { status } = await blacklist(ana, bia);

    expect(status).toBe(200);
  });

  it('refuses to blacklist yourself', async () => {
    const { status, data } = await blacklist(ana, ana);

    expect(status).toBe(400);
    expect(data.message).toBe('Cannot blacklist self.');
  });

  /** Estar bloqueado não é privilégio para se desbloquear. */
  it('does not let the blocked user lift the block', async () => {
    await blacklist(ana, bia);

    const { status, data } = await unblacklist(bia, ana);

    expect(status).toBe(403);
    expect(data.message).toMatch(/who blacklisted this relationship/i);
    expect(await statusOf(ana, bia.userId)).toBe('blacklisted');
  });

  it('lets the blocker lift their own block', async () => {
    await blacklist(ana, bia);

    const { status } = await unblacklist(ana, bia);

    expect(status).toBe(200);
    expect(await statusOf(ana, bia.userId)).toBeUndefined();
  });

  it('refuses to unblock somebody who was never blocked', async () => {
    const { status, data } = await unblacklist(ana, bia);

    expect(status).toBe(404);
    expect(data.message).toBe('User is not blacklisted by you.');
  });

  it('refuses to unblock yourself', async () => {
    const { status } = await unblacklist(ana, ana);

    expect(status).toBe(400);
  });
});

describe('GET /friend/', () => {
  it('starts empty', async () => {
    const { status, data } = await listFriendships(ana);

    expect(status).toBe(200);
    expect(data).toEqual([]);
  });

  it('enriches each relation with the other account profile', async () => {
    await sendRequest(ana, bia);
    await accept(bia, ana);

    const { data } = await listFriendships(ana);

    expect(data).toHaveLength(1);
    expect(JSON.stringify(data)).toContain('bia');
  });

  it('never leaks a password hash', async () => {
    await sendRequest(ana, bia);

    const { data } = await listFriendships(ana);

    expect(JSON.stringify(data)).not.toContain('$2b$');
  });

  it('does not show relations between other people', async () => {
    const carla = await registerUser('carla');
    await sendRequest(bia, carla);

    const { data } = await listFriendships(ana);

    expect(data).toEqual([]);
  });

  it('requires a session', async () => {
    const { status } = await request('GET', '/friend/');

    expect(status).toBe(401);
  });
});
