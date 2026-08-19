import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../src/App';
import { clearToken, setToken } from '../../src/api/apiClient';
import { flush, render } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  listUsers: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  softDelete: vi.fn(),
  restoreUser: vi.fn(),
  regenerateRecoveryCodes: vi.fn(),
  listTiers: vi.fn(),
  createTier: vi.fn(),
  updateTier: vi.fn(),
  softDeleteTier: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  listDeleted: vi.fn(),
  restoreDeleted: vi.fn(),
  browseOperationLog: vi.fn(),
  listLogs: vi.fn(),
}));

vi.mock('../../src/api/AdminAuthService', () => ({
  login: mocks.login,
  logout: vi.fn().mockResolvedValue(undefined),
  probeAdminAccess: vi.fn().mockResolvedValue(undefined),
  clearServerSession: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/api/AdminUserApiService', () => ({
  AdminUserApiService: {
    list: mocks.listUsers,
    get: mocks.getUser,
    create: mocks.createUser,
    update: mocks.updateUser,
    softDelete: mocks.softDelete,
    restore: mocks.restoreUser,
    regenerateRecoveryCodes: mocks.regenerateRecoveryCodes,
  },
}));
vi.mock('../../src/api/TierApiService', () => ({
  TierApiService: {
    list: mocks.listTiers,
    create: mocks.createTier,
    update: mocks.updateTier,
    softDelete: mocks.softDeleteTier,
  },
}));
vi.mock('../../src/api/RegistrationSettingsApiService', () => ({
  RegistrationSettingsApiService: {
    get: mocks.getSettings,
    update: mocks.updateSettings,
  },
}));
vi.mock('../../src/api/RecoveryApiService', () => ({
  RecoveryApiService: {
    listDeleted: mocks.listDeleted,
    restore: mocks.restoreDeleted,
    browseOperationLog: mocks.browseOperationLog,
  },
}));
vi.mock('../../src/api/LogsApiService', () => ({ LogsApiService: { list: mocks.listLogs } }));

const renderRoute = (route: string) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  clearToken();
  mocks.listUsers.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
  mocks.listTiers.mockResolvedValue([]);
  mocks.getSettings.mockResolvedValue({
    isRegistrationOpen: true,
    autoManage: false,
    maxUsers: null,
    defaultTierId: null,
  });
  mocks.listDeleted.mockResolvedValue([]);
  mocks.browseOperationLog.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
  mocks.listLogs.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
  mocks.login.mockResolvedValue({ userId: 'admin-1', username: 'admin' });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});

afterEach(() => {
  clearToken();
  vi.unstubAllGlobals();
});

describe('admin routes', () => {
  it('redirects an unauthenticated user to the login page', async () => {
    const view = await renderRoute('/users');

    expect(view.container.textContent).toContain('Keres Admin');
    expect(view.container.textContent).toContain('Sign in');
    await view.unmount();
  });

  it.each([
    ['/users', 'Users'],
    ['/users/new', 'New user'],
    ['/recovery', 'Recovery'],
    ['/logs', 'Logs'],
    ['/tiers', 'Tiers'],
    ['/settings', 'Registration Settings'],
  ])('renders the protected %s route', async (route, heading) => {
    setToken('admin-token');
    const view = await renderRoute(route);
    await flush();

    expect(view.container.querySelector('h1')?.textContent).toContain(heading);
    expect(view.container.textContent).toContain('Sign out');
    await view.unmount();
  });

  it('loads each screen through its intended API service', async () => {
    setToken('admin-token');
    const views = [];
    for (const route of ['/users', '/users/new', '/recovery', '/logs', '/tiers', '/settings']) {
      views.push(await renderRoute(route));
      await flush();
    }

    expect(mocks.listUsers).toHaveBeenCalled();
    expect(mocks.listTiers).toHaveBeenCalled();
    expect(mocks.getSettings).toHaveBeenCalledOnce();
    expect(mocks.listLogs).toHaveBeenCalled();
    await Promise.all(views.map((view) => view.unmount()));
  });
});
