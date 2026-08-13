import * as bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { AdminUserNotFoundError, AdminUserService, UsernameAlreadyTakenError } from '../../src/services/AdminUserService';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

beforeEach(truncateAll);

describe('AdminUserService integration', () => {
  it('creates users, prevents duplicate usernames, and filters the administrative list', async () => {
    const service = new AdminUserService();
    const admin = await service.create({ username: 'admin', password: 'secure-password', tag: 'administrator', isAdmin: true, tierId: null });
    const member = await service.create({ username: 'member', password: 'secure-password', isAdmin: false, tierId: null });
    await expect(service.create({ username: 'admin', password: 'secure-password', isAdmin: false, tierId: null })).rejects.toBeInstanceOf(UsernameAlreadyTakenError);

    const result = await service.list({ page: 1, pageSize: 10, search: 'admin', isAdmin: true, isDeleted: false });
    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: admin.id, username: 'admin', isAdmin: true });
    expect(await service.getById(member.id)).toMatchObject({ username: 'member', isAdmin: false });
  });

  it('updates, soft-deletes, restores, and resets an existing account password', async () => {
    const service = new AdminUserService();
    const created = await service.create({ username: 'member', password: 'original-password', isAdmin: false, tierId: null });

    expect(await service.update(created.id, { bio: 'Narradora', isAdmin: true })).toMatchObject({ bio: 'Narradora', isAdmin: true });
    expect(await service.softDelete(created.id)).toMatchObject({ isDeleted: true });
    expect(await service.restore(created.id)).toMatchObject({ isDeleted: false, deletedAt: null });
    await service.resetPassword(created.id);
    const stored = await db.query.users.findFirst({ where: (fields, { eq }) => eq(fields.id, created.id) });
    expect(await bcrypt.compare('abc123', stored!.password)).toBe(true);
  });

  it('returns a domain error when an administrative operation targets no account', async () => {
    const service = new AdminUserService();
    const absentId = newId();
    await expect(service.update(absentId, { isAdmin: true })).rejects.toBeInstanceOf(AdminUserNotFoundError);
    await expect(service.softDelete(absentId)).rejects.toBeInstanceOf(AdminUserNotFoundError);
    await expect(service.restore(absentId)).rejects.toBeInstanceOf(AdminUserNotFoundError);
    await expect(service.resetPassword(absentId)).rejects.toBeInstanceOf(AdminUserNotFoundError);
  });
});
