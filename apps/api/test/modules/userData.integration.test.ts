import { beforeEach, describe, expect, it } from 'vitest';
import { registerUser, request } from '../helpers/app';
import { truncateAll } from '../helpers/database';

beforeEach(async () => {
  await truncateAll();
});

describe('GET /user/data', () => {
  it('exports everything the server holds about the account', async () => {
    const ana = await registerUser('ana');

    const { status, data } = await request('GET', '/user/data', { token: ana.token });

    expect(status).toBe(200);
    expect(typeof data.exportedAt).toBe('string');
    expect(data.profile).toMatchObject({ id: ana.userId, username: 'ana' });
    expect(data.profile.password).toBeUndefined();
    // Born with both acceptances at registration.
    expect(data.legalAcceptances).toHaveLength(2);
    expect(data.legalAcceptances.map((row: { kind: string }) => row.kind).sort()).toEqual([
      'privacy',
      'tos',
    ]);
    expect(Array.isArray(data.friendships)).toBe(true);
    expect(Array.isArray(data.conversations)).toBe(true);
    expect(Array.isArray(data.publications)).toBe(true);
    expect(data.payments).toBeDefined();
    expect(data.activity).toBeDefined();
  });

  it('requires a session', async () => {
    const { status } = await request('GET', '/user/data');

    expect(status).toBe(401);
  });
});
