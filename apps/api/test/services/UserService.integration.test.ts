import { beforeEach, describe, expect, it } from 'vitest';
import {
  InvalidCurrentPasswordError,
  TagAlreadyTakenError,
  UserService,
} from '../../src/services/UserService';
import { registerUser, request } from '../helpers/app';
import { truncateAll } from '../helpers/database';

beforeEach(truncateAll);

describe('UserService', () => {
  it('resolves tags without case sensitivity but refuses a tag another account owns', async () => {
    const ana = await registerUser('ana');
    const bia = await registerUser('bia');
    const service = new UserService();
    await service.updateUserTag(ana.userId, 'Heroine');

    await expect(service.getUserByTag('hErOiNe')).resolves.toMatchObject({
      id: ana.userId,
      // Stored as a slug, whatever the capitals it was written with.
      tag: 'heroine',
    });
    await expect(service.updateUserTag(bia.userId, 'heroine')).rejects.toBeInstanceOf(
      TagAlreadyTakenError,
    );
  });

  it('requires the current password before changing it, then makes the new password usable', async () => {
    const ana = await registerUser('ana');
    const service = new UserService();

    await expect(
      service.changeOwnPassword(ana.userId, 'errada', 'senha-nova-123'),
    ).rejects.toBeInstanceOf(InvalidCurrentPasswordError);
    await service.changeOwnPassword(ana.userId, ana.password, 'senha-nova-123');

    expect(
      (
        await request('POST', '/auth/login', {
          body: { username: ana.username, password: 'senha-nova-123' },
        })
      ).status,
    ).toBe(200);
  });

  it('deactivates on self-deletion but keeps the row reserved until the prune', async () => {
    const ana = await registerUser('ana');
    const service = new UserService();

    await service.deleteOwnAccount(ana.userId, ana.password);

    // Login stops at once, while the username stays taken through the grace period.
    expect(
      (await request('POST', '/auth/login', { body: { username: ana.username, password: ana.password } }))
        .status,
    ).toBe(401);
    await expect(service.deleteOwnAccount(ana.userId, ana.password)).rejects.toThrow();
    expect(await service.pruneDeletedAccounts(30)).toBe(0);

    // Past the grace the personal data is erased and the names are freed.
    expect(await service.pruneDeletedAccounts(0)).toBe(1);
    expect(await service.pruneDeletedAccounts(0)).toBe(0);
  });
});
