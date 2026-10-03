import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/api/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/apiClient')>();
  return { ...actual, apiClient: mocks };
});

import { AdminUserApiService } from '../../src/api/AdminUserApiService';
import { ActivityApiService } from '../../src/api/ActivityApiService';
import { PaymentsApiService } from '../../src/api/PaymentsApiService';
import { LogsApiService } from '../../src/api/LogsApiService';
import { MessagesApiService } from '../../src/api/MessagesApiService';
import { RecoveryApiService } from '../../src/api/RecoveryApiService';
import { RegistrationSettingsApiService } from '../../src/api/RegistrationSettingsApiService';
import { ShowcaseSettingsApiService } from '../../src/api/ShowcaseSettingsApiService';
import { TierApiService } from '../../src/api/TierApiService';

/**
 * These modules are thin on purpose, but they are the map between screen and route: a wrong verb
 * or URL here only shows up at runtime, as a 404 or - worse - a write going to the wrong resource.
 * That is exactly what is checked here, plus the unwrapping of `data`.
 */
beforeEach(() => {
  vi.clearAllMocks();
  for (const method of [mocks.get, mocks.post, mocks.put, mocks.patch, mocks.delete]) {
    method.mockResolvedValue({ data: { ok: true } });
  }
});

describe('AdminUserApiService', () => {
  it('lists users passing the filters as query parameters', async () => {
    mocks.get.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 20 } });
    const filters = { search: 'ana', isAdmin: true, page: 2, pageSize: 20 };

    const result = await AdminUserApiService.list(filters);

    expect(mocks.get).toHaveBeenCalledWith('/admin/users', { params: filters });
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('reads a single user by id', async () => {
    await AdminUserApiService.get('user-1');

    expect(mocks.get).toHaveBeenCalledWith('/admin/users/user-1');
  });

  it('creates a user with the form payload as the body', async () => {
    const input = { username: 'ana', password: 'segredo123' } as any;

    await AdminUserApiService.create(input);

    expect(mocks.post).toHaveBeenCalledWith('/admin/users', input);
  });

  it('updates a user with PUT, not POST', async () => {
    await AdminUserApiService.update('user-1', { isAdmin: true } as any);

    expect(mocks.put).toHaveBeenCalledWith('/admin/users/user-1', { isAdmin: true });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('soft-deletes through DELETE on the user resource', async () => {
    await AdminUserApiService.softDelete('user-1');

    expect(mocks.delete).toHaveBeenCalledWith('/admin/users/user-1');
  });

  it('restores and regenerates recovery codes through their own sub-resources', async () => {
    await AdminUserApiService.restore('user-1');
    await AdminUserApiService.regenerateRecoveryCodes('user-1');

    expect(mocks.post).toHaveBeenNthCalledWith(1, '/admin/users/user-1/restore');
    expect(mocks.post).toHaveBeenNthCalledWith(2, '/admin/users/user-1/regenerate-recovery-codes');
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

    expect(mocks.get).toHaveBeenNthCalledWith(1, '/admin/tiers', {
      params: { includeDeleted: false },
    });
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/admin/tiers', {
      params: { includeDeleted: true },
    });
  });

  it.each([
    ['get', () => TierApiService.get('tier-1'), 'get', ['/admin/tiers/tier-1']],
    [
      'create',
      () => TierApiService.create({ name: 'Pro' } as any),
      'post',
      ['/admin/tiers', { name: 'Pro' }],
    ],
    [
      'update',
      () => TierApiService.update('tier-1', { name: 'Pro+' } as any),
      'put',
      ['/admin/tiers/tier-1', { name: 'Pro+' }],
    ],
    ['softDelete', () => TierApiService.softDelete('tier-1'), 'delete', ['/admin/tiers/tier-1']],
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
    expect(mocks.get).toHaveBeenCalledWith('/admin/registration-settings');
  });

  it('updates with PUT, since the resource is a singleton', async () => {
    await RegistrationSettingsApiService.update({ allowRegistration: true } as any);

    expect(mocks.put).toHaveBeenCalledWith('/admin/registration-settings', {
      allowRegistration: true,
    });
  });
});

describe('ShowcaseSettingsApiService', () => {
  it('reads the settings from the singleton resource', async () => {
    mocks.get.mockResolvedValue({
      data: { id: 'singleton', isShowcaseEnabled: true, isHostedClientEnabled: true },
    });

    await expect(ShowcaseSettingsApiService.get()).resolves.toEqual({
      id: 'singleton',
      isShowcaseEnabled: true,
      isHostedClientEnabled: true,
    });
    expect(mocks.get).toHaveBeenCalledWith('/admin/showcase-settings');
  });

  it('updates with PUT, sending only the toggled flags', async () => {
    await ShowcaseSettingsApiService.update({ isShowcaseEnabled: true });

    expect(mocks.put).toHaveBeenCalledWith('/admin/showcase-settings', {
      isShowcaseEnabled: true,
    });
  });
});

describe('PaymentsApiService', () => {
  it('maps the summary, the subscriptions and the ledger to the payments routes', async () => {
    await PaymentsApiService.summary();
    await PaymentsApiService.subscriptions({ status: 'due', page: 2 });
    await PaymentsApiService.events({ page: 3 });

    expect(mocks.get).toHaveBeenCalledWith('/admin/payments/summary');
    expect(mocks.get).toHaveBeenCalledWith('/admin/payments/subscriptions', {
      params: { status: 'due', page: 2 },
    });
    expect(mocks.get).toHaveBeenCalledWith('/admin/payments/events', { params: { page: 3 } });
  });

  it('reads one person’s subscription, and gives a plan, on the routes of that person', async () => {
    mocks.get.mockResolvedValue({ data: { subscription: null, canCancelAtProvider: false } });
    mocks.post.mockResolvedValue({ data: { subscription: null, canCancelAtProvider: false } });

    await expect(PaymentsApiService.userSubscription('user-1')).resolves.toEqual({
      subscription: null,
      canCancelAtProvider: false,
    });
    await PaymentsApiService.giveGift('user-1', {
      tierId: 'tier-1',
      months: 2,
      cancelRenewal: true,
      consent: true,
    });

    expect(mocks.get).toHaveBeenCalledWith('/admin/payments/users/user-1/subscription');
    expect(mocks.post).toHaveBeenCalledWith('/admin/payments/users/user-1/gift', {
      tierId: 'tier-1',
      months: 2,
      cancelRenewal: true,
      consent: true,
    });
  });

  it('refuses an id that is not a single path segment, rather than sending it', async () => {
    await expect(PaymentsApiService.userSubscription('../users')).rejects.toThrow();
    await expect(PaymentsApiService.giveGift('a/b', { tierId: 't', months: 1 })).rejects.toThrow();
  });
});

describe('ActivityApiService', () => {
  it('maps the record, its summary and its export to the activity routes', async () => {
    await ActivityApiService.list({ category: 'auth', page: 2 });
    await ActivityApiService.summary(168);
    await ActivityApiService.exportCsv({ outcome: 'failure' });

    expect(mocks.get).toHaveBeenCalledWith('/admin/activity', {
      params: { category: 'auth', page: 2 },
    });
    expect(mocks.get).toHaveBeenCalledWith('/admin/activity/summary', { params: { hours: 168 } });
    expect(mocks.get).toHaveBeenCalledWith('/admin/activity/export', {
      params: { outcome: 'failure' },
      responseType: 'blob',
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

    expect(mocks.get).toHaveBeenCalledWith('/admin/logs', { params: filters });
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 50 });
  });
});

describe('RecoveryApiService', () => {
  it('lists deleted rows filtered by entity type, story, and search', async () => {
    mocks.get.mockResolvedValue({ data: [] });
    const filters = { entityType: 'Character', storyId: 'story-1', search: 'ana' };

    await RecoveryApiService.listDeleted(filters);

    expect(mocks.get).toHaveBeenCalledWith('/admin/recovery/deleted', { params: filters });
  });

  it('restores a row through its entity type and id', async () => {
    await RecoveryApiService.restore('Character', 'char-1');

    expect(mocks.post).toHaveBeenCalledWith('/admin/recovery/Character/char-1/restore');
  });

  it('browses the operation log with pagination filters', async () => {
    mocks.get.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 50 } });
    const filters = {
      storyId: 'story-1',
      operationType: 'delete',
      search: 'ana',
      page: 3,
      pageSize: 50,
    };

    const result = await RecoveryApiService.browseOperationLog(filters);

    expect(mocks.get).toHaveBeenCalledWith('/admin/recovery/operation-log', {
      params: filters,
    });
    expect(result.pageSize).toBe(50);
  });
});

describe('MessagesApiService', () => {
  it('maps the inbox calls to the message routes', async () => {
    await MessagesApiService.list({ source: 'site', page: 2 });
    await MessagesApiService.open('msg-1');
    await MessagesApiService.patch('msg-1', { archived: true });
    await MessagesApiService.reply('msg-1', 'Hello');
    await MessagesApiService.remove('msg-1');
    await MessagesApiService.unreadCount();

    expect(mocks.get).toHaveBeenCalledWith('/admin/messages', {
      params: { source: 'site', page: 2 },
    });
    expect(mocks.get).toHaveBeenCalledWith('/admin/messages/msg-1');
    expect(mocks.patch).toHaveBeenCalledWith('/admin/messages/msg-1', { archived: true });
    expect(mocks.post).toHaveBeenCalledWith('/admin/messages/msg-1/reply', { body: 'Hello' });
    expect(mocks.delete).toHaveBeenCalledWith('/admin/messages/msg-1');
    expect(mocks.get).toHaveBeenCalledWith('/admin/messages/unread-count');
  });

  it('refuses unsafe path segments', async () => {
    await expect(MessagesApiService.open('../x')).rejects.toThrow();
    await expect(MessagesApiService.patch('../x', { read: true })).rejects.toThrow();
    await expect(MessagesApiService.reply('../x', 'hi')).rejects.toThrow();
    await expect(MessagesApiService.remove('../x')).rejects.toThrow();
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
