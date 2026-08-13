import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), eq: vi.fn() }));

vi.mock('../../src/db', () => ({ db: { query: { users: { findFirst: mocks.findFirst } } } }));
vi.mock('../../src/db/schema', () => ({ users: { id: 'users.id' } }));
vi.mock('drizzle-orm', () => ({ eq: mocks.eq }));

import { requireAdmin } from '../../src/utils/adminAuth';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eq.mockReturnValue('user-id-condition');
});

describe('requireAdmin', () => {
  it('rejects requests that have no authenticated user before querying the database', async () => {
    await expect(requireAdmin(null)).rejects.toMatchObject({ status: 401, message: 'Unauthorized' });
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['no matching account', undefined],
    ['a deleted account', { id: 'admin-1', isAdmin: true, isDeleted: true }],
    ['a non-admin account', { id: 'admin-1', isAdmin: false, isDeleted: false }],
  ])('rejects %s even when the JWT was valid', async (_label, row) => {
    mocks.findFirst.mockResolvedValue(row);

    await expect(requireAdmin({ userId: 'admin-1', username: 'admin' })).rejects.toMatchObject({
      status: 403,
      message: 'Admin access required.',
    });
  });

  it('checks the current database role instead of trusting an old token claim', async () => {
    mocks.findFirst.mockResolvedValue({ id: 'admin-1', isAdmin: true, isDeleted: false });

    await expect(requireAdmin({ userId: 'admin-1', username: 'admin' })).resolves.toBe('admin-1');
    expect(mocks.eq).toHaveBeenCalledWith('users.id', 'admin-1');
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: 'user-id-condition',
      columns: { id: true, isAdmin: true, isDeleted: true },
    });
  });
});
