import { beforeEach, describe, expect, it } from 'vitest';
import {
  AdminUserNotFoundError,
  AdminUserService,
  UsernameAlreadyTakenError,
} from '../../src/services/AdminUserService';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

beforeEach(truncateAll);

describe('tags made by the administrative panel', () => {
  it('stores the tag an admin typed as a slug, and makes one from the username otherwise', async () => {
    const service = new AdminUserService();
    const typed = await service.create({
      username: 'Maria Souza',
      password: 'secure-password',
      tag: 'Maria Souza',
      isAdmin: false,
      tierId: null,
    });
    const derived = await service.create({
      username: 'João Lima',
      password: 'secure-password',
      isAdmin: false,
      tierId: null,
    });

    expect(typed.tag).toBe('maria_souza');
    expect(derived.tag).toBe('joao_lima');
  });

  it('keeps an edited tag in the same shape, and refuses one another account holds', async () => {
    const service = new AdminUserService();
    const first = await service.create({
      username: 'first',
      password: 'secure-password',
      isAdmin: false,
      tierId: null,
    });
    const second = await service.create({
      username: 'second',
      password: 'secure-password',
      isAdmin: false,
      tierId: null,
    });

    const updated = await service.update(second.id, { tag: 'Second One' });
    expect(updated?.tag).toBe('second_one');

    await expect(service.update(second.id, { tag: 'FIRST' })).rejects.toThrow(
      'Tag is already taken.',
    );
    // Its own tag, written in other capitals, is not a clash.
    expect((await service.update(first.id, { tag: 'First' }))?.tag).toBe('first');
  });
});

describe('AdminUserService integration', () => {
  it('creates users, prevents duplicate usernames, and filters the administrative list', async () => {
    const service = new AdminUserService();
    const admin = await service.create({
      username: 'admin',
      password: 'secure-password',
      tag: 'administrator',
      isAdmin: true,
      tierId: null,
    });
    const member = await service.create({
      username: 'member',
      password: 'secure-password',
      isAdmin: false,
      tierId: null,
    });
    await expect(
      service.create({
        username: 'admin',
        password: 'secure-password',
        isAdmin: false,
        tierId: null,
      }),
    ).rejects.toBeInstanceOf(UsernameAlreadyTakenError);

    const result = await service.list({
      page: 1,
      pageSize: 10,
      search: 'admin',
      isAdmin: true,
      isDeleted: false,
    });
    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: admin.id, username: 'admin', isAdmin: true });
    expect(await service.getById(member.id)).toMatchObject({ username: 'member', isAdmin: false });
  });

  it('updates, soft-deletes, restores an existing account, and regenerates its recovery codes', async () => {
    const service = new AdminUserService();
    const created = await service.create({
      username: 'member',
      password: 'original-password',
      isAdmin: false,
      tierId: null,
    });
    expect(created.recoveryCodes).toHaveLength(8);

    expect(await service.update(created.id, { bio: 'Narradora', isAdmin: true })).toMatchObject({
      bio: 'Narradora',
      isAdmin: true,
    });
    expect(await service.softDelete(created.id)).toMatchObject({ isDeleted: true });
    expect(await service.restore(created.id)).toMatchObject({ isDeleted: false, deletedAt: null });

    const regenerated = await service.regenerateRecoveryCodes(created.id);
    expect(regenerated).toHaveLength(8);
    // A new batch, with no overlap with create()'s - the previous one was invalidated.
    expect(regenerated.some((code) => created.recoveryCodes.includes(code))).toBe(false);
  });

  it('returns a domain error when an administrative operation targets no account', async () => {
    const service = new AdminUserService();
    const absentId = newId();
    await expect(service.update(absentId, { isAdmin: true })).rejects.toBeInstanceOf(
      AdminUserNotFoundError,
    );
    await expect(service.softDelete(absentId)).rejects.toBeInstanceOf(AdminUserNotFoundError);
    await expect(service.restore(absentId)).rejects.toBeInstanceOf(AdminUserNotFoundError);
    await expect(service.regenerateRecoveryCodes(absentId)).rejects.toBeInstanceOf(
      AdminUserNotFoundError,
    );
  });
});
