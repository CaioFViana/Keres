import { beforeEach, describe, expect, it } from 'vitest';
import {
  InvalidRecoveryCodeError,
  RecoveryCodeService,
} from '../../src/services/RecoveryCodeService';
import { newId, request } from '../helpers/app';
import { truncateAll } from '../helpers/database';

interface RegisteredUser {
  userId: string;
  username: string;
  recoveryCodes: string[];
}

async function registerWithCodes(): Promise<RegisteredUser> {
  const username = `recover_${newId().slice(-10).toLowerCase()}`;
  const { status, data } = await request('POST', '/auth/register', {
    body: { username, password: 'senha-inicial-123' },
  });
  expect(status).toBe(200);
  return data as RegisteredUser;
}

beforeEach(truncateAll);

describe('RecoveryCodeService', () => {
  it('consumes one code atomically, changes the password, and never accepts that code again', async () => {
    const user = await registerWithCodes();
    const service = new RecoveryCodeService();

    expect(await service.countRemaining(user.userId)).toBe(8);
    await expect(
      service.redeemCode(user.username, user.recoveryCodes[0], 'senha-nova-123'),
    ).resolves.toMatchObject({
      id: user.userId,
      username: user.username,
    });
    expect(await service.countRemaining(user.userId)).toBe(7);
    await expect(
      service.redeemCode(user.username, user.recoveryCodes[0], 'outra-senha-123'),
    ).rejects.toBeInstanceOf(InvalidRecoveryCodeError);

    expect(
      (
        await request('POST', '/auth/login', {
          body: { username: user.username, password: 'senha-nova-123' },
        })
      ).status,
    ).toBe(200);
  });

  it('replaces the entire old batch when codes are regenerated', async () => {
    const user = await registerWithCodes();
    const service = new RecoveryCodeService();
    const regenerated = await service.generateCodes(user.userId);

    expect(regenerated).toHaveLength(8);
    expect(regenerated).not.toContain(user.recoveryCodes[0]);
    expect(await service.countRemaining(user.userId)).toBe(8);
    await expect(
      service.redeemCode(user.username, user.recoveryCodes[0], 'senha-nova-123'),
    ).rejects.toBeInstanceOf(InvalidRecoveryCodeError);
  });

  it('allows exactly one of two simultaneous attempts to redeem the same code', async () => {
    const user = await registerWithCodes();
    const service = new RecoveryCodeService();
    const results = await Promise.allSettled([
      service.redeemCode(user.username, user.recoveryCodes[0], 'senha-a-123'),
      service.redeemCode(user.username, user.recoveryCodes[0], 'senha-b-123'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await service.countRemaining(user.userId)).toBe(7);
  });
});
