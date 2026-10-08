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
  getShowcaseSettings: vi.fn(),
  updateShowcaseSettings: vi.fn(),
  updateSettings: vi.fn(),
  listDeleted: vi.fn(),
  restoreDeleted: vi.fn(),
  browseOperationLog: vi.fn(),
  listLogs: vi.fn(),
  listActivity: vi.fn(),
  paymentsSummary: vi.fn(),
  paymentsHealth: vi.fn(),
  paymentsSubscriptions: vi.fn(),
  paymentsEvents: vi.fn(),
  activitySummary: vi.fn(),
  listMessages: vi.fn(),
  unreadMessages: vi.fn(),
}));

vi.mock('../../src/api/AdminAuthService', () => ({
  login: mocks.login,
  logout: vi.fn().mockResolvedValue(undefined),
  probeAdminAccess: vi.fn().mockResolvedValue(undefined),
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
vi.mock('../../src/api/ShowcaseSettingsApiService', () => ({
  ShowcaseSettingsApiService: {
    get: mocks.getShowcaseSettings,
    update: mocks.updateShowcaseSettings,
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
vi.mock('../../src/api/PaymentsApiService', () => ({
  PaymentsApiService: {
    summary: mocks.paymentsSummary,
    health: mocks.paymentsHealth,
    subscriptions: mocks.paymentsSubscriptions,
    events: mocks.paymentsEvents,
  },
}));
vi.mock('../../src/api/ActivityApiService', () => ({
  ActivityApiService: {
    list: mocks.listActivity,
    summary: mocks.activitySummary,
    exportCsv: vi.fn(),
  },
}));
vi.mock('../../src/api/MessagesApiService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/api/MessagesApiService')>()),
  MessagesApiService: { list: mocks.listMessages, unreadCount: mocks.unreadMessages },
}));

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
  mocks.getShowcaseSettings.mockResolvedValue({
    id: 'singleton',
    isShowcaseEnabled: false,
    updatedAt: '2026-08-19T00:00:00.000Z',
  });
  mocks.getSettings.mockResolvedValue({
    isRegistrationOpen: true,
    autoManage: false,
    maxUsers: null,
    defaultTierId: null,
  });
  mocks.listDeleted.mockResolvedValue([]);
  mocks.browseOperationLog.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
  mocks.listLogs.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
  mocks.listActivity.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
  mocks.paymentsSummary.mockResolvedValue(null);
  mocks.paymentsHealth.mockResolvedValue(null);
  mocks.paymentsSubscriptions.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
  mocks.paymentsEvents.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
  mocks.activitySummary.mockResolvedValue(null);
  mocks.listMessages.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
  mocks.unreadMessages.mockResolvedValue({ unread: 0 });
  mocks.login.mockResolvedValue({ userId: 'admin-1', username: 'admin' });
});

afterEach(() => {
  clearToken();
  vi.unstubAllGlobals();
  // `unstubAllGlobals` clears per-test stubs (confirm/alert); keep the suite-wide act flag.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

describe('admin routes', () => {
  it('redirects an unauthenticated user to the login page', async () => {
    const view = await renderRoute('/users');

    expect(view.container.textContent).toContain('Keres Admin');
    expect(view.container.textContent).toContain('Sign in');
    await view.unmount();
  });

  it.each([
    ['/users', 'Users', 'h1'],
    // Creating an account is a dialog over the list, so its title is the dialog's, not the page's.
    ['/users/new', 'New user', '.modal h3'],
    ['/recovery', 'Recovery', 'h1'],
    ['/activity', 'Activity', 'h1'],
    ['/payments', 'Payments', 'h1'],
    ['/logs', 'Logs', 'h1'],
    ['/tiers', 'Tiers', 'h1'],
    ['/messages', 'Messages', 'h1'],
    ['/contact', 'Messages', 'h1'],
    ['/settings', 'Settings', 'h1'],
  ])('renders the protected %s route', async (route, heading, selector) => {
    setToken('admin-token');
    const view = await renderRoute(route);
    await flush();

    expect(view.container.querySelector(selector)?.textContent).toContain(heading);
    expect(
      view.container.querySelector('.sidebar-footer button[aria-label="Sign out"]'),
    ).not.toBeNull();
    await view.unmount();
  });

  it('loads each screen through its intended API service', async () => {
    setToken('admin-token');
    const views = [];
    for (const route of [
      '/users',
      '/users/new',
      '/recovery',
      '/activity',
      '/payments',
      '/logs',
      '/tiers',
      '/messages',
      '/settings',
    ]) {
      views.push(await renderRoute(route));
      await flush();
    }

    expect(mocks.listUsers).toHaveBeenCalled();
    expect(mocks.listTiers).toHaveBeenCalled();
    expect(mocks.listMessages).toHaveBeenCalled();
    // Twice: the tiers screen also loads the settings, for the price currency.
    expect(mocks.getSettings).toHaveBeenCalledTimes(2);
    expect(mocks.listLogs).toHaveBeenCalled();
    expect(mocks.listActivity).toHaveBeenCalled();
    expect(mocks.paymentsSubscriptions).toHaveBeenCalled();
    // Sequential unmount: each helper wraps `root.unmount()` in `act()`, and React 19
    // rejects overlapping act() calls when several roots tear down in parallel.
    for (const view of views) {
      await view.unmount();
    }
  });
});
