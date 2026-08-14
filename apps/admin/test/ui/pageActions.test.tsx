import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { LogsPage } from '../../src/pages/logs/LogsPage';
import { RecoveryPage } from '../../src/pages/recovery/RecoveryPage';
import { RegistrationSettingsPage } from '../../src/pages/settings/RegistrationSettingsPage';
import { TiersPage } from '../../src/pages/tiers/TiersPage';
import { UserFormPage } from '../../src/pages/users/UserFormPage';
import { UsersListPage } from '../../src/pages/users/UsersListPage';
import { changeInput, click, flush, render, submit } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  softDeleteUser: vi.fn(),
  restoreUser: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  resetPassword: vi.fn(),
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

vi.mock('../../src/api/AdminUserApiService', () => ({
  AdminUserApiService: {
    list: mocks.listUsers,
    create: mocks.createUser,
    softDelete: mocks.softDeleteUser,
    restore: mocks.restoreUser,
    get: mocks.getUser,
    update: mocks.updateUser,
    resetPassword: mocks.resetPassword,
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
  RegistrationSettingsApiService: { get: mocks.getSettings, update: mocks.updateSettings },
}));
vi.mock('../../src/api/RecoveryApiService', () => ({
  RecoveryApiService: {
    listDeleted: mocks.listDeleted,
    restore: mocks.restoreDeleted,
    browseOperationLog: mocks.browseOperationLog,
  },
}));
vi.mock('../../src/api/LogsApiService', () => ({ LogsApiService: { list: mocks.listLogs } }));

const withRouter = (page: ReactElement, route = '/') =>
  render(<MemoryRouter initialEntries={[route]}>{page}</MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
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
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  vi.stubGlobal('alert', vi.fn());
});

describe('admin page actions', () => {
  it('soft-deletes a selected user after confirmation', async () => {
    mocks.listUsers.mockResolvedValue({
      items: [
        {
          id: 'user-1',
          username: 'Ana',
          tag: 'ana',
          isAdmin: false,
          tierId: null,
          isDeleted: false,
          createdAt: '2026-01-01',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
    });
    const view = await withRouter(<UsersListPage />);
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Delete',
      )!,
    );
    await flush();

    expect(mocks.softDeleteUser).toHaveBeenCalledWith('user-1');
    await view.unmount();
  });

  it('creates a user from the new-user form', async () => {
    const view = await withRouter(<UserFormPage />, '/users/new');
    await flush();
    const inputs = view.container.querySelectorAll('input');

    await changeInput(inputs[0], 'ana');
    await changeInput(inputs[1], 'password123');
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'ana', password: 'password123', isAdmin: false }),
    );
    await view.unmount();
  });

  it('creates a tier and converts blank limits to null', async () => {
    const view = await withRouter(<TiersPage />);
    await flush();
    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'New tier',
      )!,
    );
    await changeInput(view.container.querySelector('input')!, 'Pro');
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.createTier).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Pro', maxStories: null }),
    );
    await view.unmount();
  });

  it('saves registration settings after loading them', async () => {
    const view = await withRouter(<RegistrationSettingsPage />);
    await flush();
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.updateSettings).toHaveBeenCalledWith({
      isRegistrationOpen: true,
      autoManage: false,
      maxUsers: null,
      defaultTierId: null,
    });
    await view.unmount();
  });

  it('searches and restores deleted records', async () => {
    mocks.listDeleted.mockResolvedValue([
      {
        entityType: 'Character',
        id: 'char-1',
        name: 'Ana',
        storyId: 'story-1',
        deletedAt: '2026-01-01',
        version: 4,
      },
    ]);
    const view = await withRouter(<RecoveryPage />);

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Search',
      )!,
    );
    await flush();
    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Restore',
      )!,
    );
    await flush();

    expect(mocks.listDeleted).toHaveBeenCalledWith({ entityType: undefined, storyId: undefined });
    expect(mocks.restoreDeleted).toHaveBeenCalledWith('Character', 'char-1');
    await view.unmount();
  });

  it('sends log filters when the operator searches', async () => {
    const view = await withRouter(<LogsPage />);
    await flush();
    await changeInput(view.container.querySelector('select')!, 'error');
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.listLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ level: 'error', page: 1, pageSize: 50 }),
    );
    await view.unmount();
  });
});
