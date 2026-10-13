import { beforeEach, describe, expect, it } from 'vitest';
import { accessRecordService } from '../../src/services/AccessRecordService';
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

  it("lists only the account's own sign-in records and no identity commitment", async () => {
    const ana = await registerUser('ana');
    const bia = await registerUser('bia');
    await accessRecordService.recordNow({ event: 'login', ip: '203.0.113.7', userId: ana.userId });
    await accessRecordService.recordNow({ event: 'login', ip: '198.51.100.9', userId: bia.userId });
    await accessRecordService.recordNow({
      event: 'login_failed',
      ip: '192.0.2.1',
      username: 'nobody',
    });

    const { data } = await request('GET', '/user/data', { token: ana.token });

    const addresses = data.accessRecords.items.map((item: { ip: string }) => item.ip);
    expect(addresses).toContain('203.0.113.7');
    expect(addresses).not.toContain('198.51.100.9');
    expect(addresses).not.toContain('192.0.2.1');
    expect(data.accessRecords.keptDays).toBeGreaterThan(0);
    expect(data.ageVerification).toEqual([]);
    expect(JSON.stringify(data)).not.toMatch(/identityCommitment|identity_commitment/);
  });

  it('requires a session', async () => {
    const { status } = await request('GET', '/user/data');

    expect(status).toBe(401);
  });
});
