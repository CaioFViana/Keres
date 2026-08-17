import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/api/apiClient', () => ({ apiClient: mocks }));

import { AdminUserApiService } from '../../src/api/AdminUserApiService';
import { LogsApiService } from '../../src/api/LogsApiService';
import { RecoveryApiService } from '../../src/api/RecoveryApiService';
import { RegistrationSettingsApiService } from '../../src/api/RegistrationSettingsApiService';
import { TierApiService } from '../../src/api/TierApiService';

/**
 * Estes módulos são finos de propósito, mas são o mapa entre a tela e a rota: um verbo ou uma
 * URL errada aqui só aparece em runtime, como um 404 ou - pior - uma escrita indo para o
 * recurso errado. O que se verifica é exatamente isso, mais o desembrulho do `data`.
 */
beforeEach(() => {
  vi.clearAllMocks();
  for (const method of [mocks.get, mocks.post, mocks.put, mocks.delete]) {
    method.mockResolvedValue({ data: { ok: true } });
  }
});

describe('AdminUserApiService', () => {
  it('lists users passing the filters as query parameters', async () => {
    mocks.get.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 20 } });
    const filters = { search: 'ana', isAdmin: true, page: 2, pageSize: 20 };

    const result = await AdminUserApiService.list(filters);

    expect(mocks.get).toHaveBeenCalledWith('/admin/api/users', { params: filters });
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('reads a single user by id', async () => {
    await AdminUserApiService.get('user-1');

    expect(mocks.get).toHaveBeenCalledWith('/admin/api/users/user-1');
  });

  it('creates a user with the form payload as the body', async () => {
    const input = { username: 'ana', password: 'segredo123' } as any;

    await AdminUserApiService.create(input);

    expect(mocks.post).toHaveBeenCalledWith('/admin/api/users', input);
  });

  it('updates a user with PUT, not POST', async () => {
    await AdminUserApiService.update('user-1', { isAdmin: true } as any);

    expect(mocks.put).toHaveBeenCalledWith('/admin/api/users/user-1', { isAdmin: true });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('soft-deletes through DELETE on the user resource', async () => {
    await AdminUserApiService.softDelete('user-1');

    expect(mocks.delete).toHaveBeenCalledWith('/admin/api/users/user-1');
  });

  it('restores and regenerates recovery codes through their own sub-resources', async () => {
    await AdminUserApiService.restore('user-1');
    await AdminUserApiService.regenerateRecoveryCodes('user-1');

    expect(mocks.post).toHaveBeenNthCalledWith(1, '/admin/api/users/user-1/restore');
    expect(mocks.post).toHaveBeenNthCalledWith(
      2,
      '/admin/api/users/user-1/regenerate-recovery-codes',
    );
  });

  it('returns the fresh recovery codes after regenerating', async () => {
    mocks.post.mockResolvedValue({ data: { recoveryCodes: ['AAAAA-11111', 'BBBBB-22222'] } });

    await expect(AdminUserApiService.regenerateRecoveryCodes('user-1')).resolves.toEqual({
      recoveryCodes: ['AAAAA-11111', 'BBBBB-22222'],
    });
  });

  it('propagates the error the interceptor already normalized', async () => {
    mocks.get.mockRejectedValue(new Error('Username already taken.'));

    await expect(AdminUserApiService.get('user-1')).rejects.toThrow('Username already taken.');
  });
});

describe('TierApiService', () => {
  it('excludes deleted tiers unless the caller asks for them', async () => {
    await TierApiService.list();
    await TierApiService.list(true);

    expect(mocks.get).toHaveBeenNthCalledWith(1, '/admin/api/tiers', {
      params: { includeDeleted: false },
    });
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/admin/api/tiers', {
      params: { includeDeleted: true },
    });
  });

  it.each([
    ['get', () => TierApiService.get('tier-1'), 'get', ['/admin/api/tiers/tier-1']],
    [
      'create',
      () => TierApiService.create({ name: 'Pro' } as any),
      'post',
      ['/admin/api/tiers', { name: 'Pro' }],
    ],
    [
      'update',
      () => TierApiService.update('tier-1', { name: 'Pro+' } as any),
      'put',
      ['/admin/api/tiers/tier-1', { name: 'Pro+' }],
    ],
    [
      'softDelete',
      () => TierApiService.softDelete('tier-1'),
      'delete',
      ['/admin/api/tiers/tier-1'],
    ],
  ])('routes %s to the right verb and URL', async (_label, call, method, expectedArgs) => {
    await call();

    expect(mocks[method as keyof typeof mocks]).toHaveBeenCalledWith(
      ...(expectedArgs as [string, unknown?]),
    );
  });
});

describe('RegistrationSettingsApiService', () => {
  it('reads the settings from the singleton resource', async () => {
    mocks.get.mockResolvedValue({ data: { allowRegistration: false } });

    await expect(RegistrationSettingsApiService.get()).resolves.toEqual({
      allowRegistration: false,
    });
    expect(mocks.get).toHaveBeenCalledWith('/admin/api/registration-settings');
  });

  it('updates with PUT, since the resource is a singleton', async () => {
    await RegistrationSettingsApiService.update({ allowRegistration: true } as any);

    expect(mocks.put).toHaveBeenCalledWith('/admin/api/registration-settings', {
      allowRegistration: true,
    });
  });
});

describe('LogsApiService', () => {
  it('browses persisted API logs with the filters as query parameters', async () => {
    mocks.get.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 50 } });
    const filters = {
      level: 'error' as const,
      storyId: 'story-1',
      userId: 'user-1',
      page: 2,
      pageSize: 50,
    };

    const result = await LogsApiService.list(filters);

    expect(mocks.get).toHaveBeenCalledWith('/admin/api/logs', { params: filters });
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 50 });
  });
});

describe('RecoveryApiService', () => {
  it('lists deleted rows filtered by entity type and story', async () => {
    mocks.get.mockResolvedValue({ data: [] });
    const filters = { entityType: 'Character', storyId: 'story-1' };

    await RecoveryApiService.listDeleted(filters);

    expect(mocks.get).toHaveBeenCalledWith('/admin/api/recovery/deleted', { params: filters });
  });

  it('restores a row through its entity type and id', async () => {
    await RecoveryApiService.restore('Character', 'char-1');

    expect(mocks.post).toHaveBeenCalledWith('/admin/api/recovery/Character/char-1/restore');
  });

  it('browses the operation log with pagination filters', async () => {
    mocks.get.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 50 } });
    const filters = { storyId: 'story-1', operationType: 'delete', page: 3, pageSize: 50 };

    const result = await RecoveryApiService.browseOperationLog(filters);

    expect(mocks.get).toHaveBeenCalledWith('/admin/api/recovery/operation-log', {
      params: filters,
    });
    expect(result.pageSize).toBe(50);
  });
});
