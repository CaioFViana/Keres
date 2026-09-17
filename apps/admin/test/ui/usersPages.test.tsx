import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { UserFormPage } from '../../src/pages/users/UserFormPage';
import { UsersListPage } from '../../src/pages/users/UsersListPage';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { changeInput, click, flush, render, submit } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  listUsers: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  softDeleteUser: vi.fn(),
  restoreUser: vi.fn(),
  regenerateRecoveryCodes: vi.fn(),
  listTiers: vi.fn(),
}));

vi.mock('../../src/api/AdminUserApiService', () => ({
  AdminUserApiService: {
    list: mocks.listUsers,
    get: mocks.getUser,
    create: mocks.createUser,
    update: mocks.updateUser,
    softDelete: mocks.softDeleteUser,
    restore: mocks.restoreUser,
    regenerateRecoveryCodes: mocks.regenerateRecoveryCodes,
  },
}));
vi.mock('../../src/api/TierApiService', () => ({
  TierApiService: { list: mocks.listTiers },
}));

const user = (over: Record<string, unknown> = {}) => ({
  id: 'user-1',
  username: 'ana',
  tag: 'ana',
  isAdmin: false,
  tierId: null,
  bio: null,
  isDeleted: false,
  createdAt: '2026-08-19T10:00:00.000Z',
  ...over,
});

const tier = (over: Record<string, unknown> = {}) => ({
  id: 'tier-1',
  name: 'Pro',
  ...over,
});

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/users']}>
      <ThemeProvider>
        <Routes>
          <Route path="/users" element={<UsersListPage />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

function renderFormAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <Routes>
          <Route path="/users/new" element={<UserFormPage />} />
          <Route path="/users/:id" element={<UserFormPage />} />
          <Route path="/users" element={<p>users list</p>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

const deleteButton = (container: HTMLDivElement) =>
  Array.from(container.querySelectorAll('tbody button')).find(
    (button) => button.textContent === 'Delete',
  )!;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listUsers.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
  mocks.listTiers.mockResolvedValue([]);
  mocks.getUser.mockResolvedValue(user());
  mocks.createUser.mockResolvedValue({ id: 'user-9', recoveryCodes: [] });
  mocks.updateUser.mockResolvedValue({});
  mocks.softDeleteUser.mockResolvedValue({});
  mocks.restoreUser.mockResolvedValue({});
  mocks.regenerateRecoveryCodes.mockResolvedValue({ recoveryCodes: [] });
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  vi.stubGlobal('alert', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // Removing the per-test clipboard stub restores jsdom's navigator.
  // @ts-expect-error the stub added a property jsdom never ships
  delete navigator.clipboard;
});

describe('users list', () => {
  it('searches and shows deleted users on demand', async () => {
    const view = await renderList();
    await flush();

    await changeInput(view.container.querySelector('.toolbar input')!, 'ana');
    await submit(view.container.querySelector('form')!);
    await flush();
    expect(mocks.listUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'ana', page: 1 }),
    );

    await click(view.container.querySelector('.toolbar input[type="checkbox"]')!);
    await flush();
    expect(mocks.listUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({ isDeleted: true, page: 1 }),
    );
    await view.unmount();
  });

  it('pages through the list', async () => {
    mocks.listUsers.mockResolvedValue({ items: [], total: 30, page: 1, pageSize: 25 });
    const view = await renderList();
    await flush();
    const [, next] = Array.from(view.container.querySelectorAll('.pagination button'));

    await click(next);
    await flush();

    expect(mocks.listUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    await view.unmount();
  });

  it('walks back to the first page', async () => {
    mocks.listUsers.mockResolvedValue({ items: [], total: 30, page: 1, pageSize: 25 });
    const view = await renderList();
    await flush();
    const [previous, next] = Array.from(view.container.querySelectorAll('.pagination button'));

    await click(next);
    await flush();
    await click(previous);
    await flush();

    expect(mocks.listUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
    await view.unmount();
  });

  it('restores a deleted user without asking again', async () => {
    mocks.listUsers.mockResolvedValue({
      items: [user({ isDeleted: true })],
      total: 1,
      page: 1,
      pageSize: 25,
    });
    const view = await renderList();
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('tbody button')).find(
        (button) => button.textContent === 'Restore',
      )!,
    );
    await flush();

    expect(mocks.restoreUser).toHaveBeenCalledWith('user-1');
    expect(window.confirm).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('warns explicitly before deleting an admin', async () => {
    mocks.listUsers.mockResolvedValue({
      items: [user({ isAdmin: true })],
      total: 1,
      page: 1,
      pageSize: 25,
    });
    const view = await renderList();
    await flush();

    await click(deleteButton(view.container));
    await flush();

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(vi.mocked(window.confirm).mock.calls[0][0]).toContain('ana');
    expect(mocks.softDeleteUser).toHaveBeenCalledWith('user-1');
    await view.unmount();
  });

  it('deletes nothing when the operator cancels', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    mocks.listUsers.mockResolvedValue({ items: [user()], total: 1, page: 1, pageSize: 25 });
    const view = await renderList();
    await flush();

    await click(deleteButton(view.container));
    await flush();

    expect(mocks.softDeleteUser).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('reports a delete failure', async () => {
    mocks.listUsers.mockResolvedValue({ items: [user()], total: 1, page: 1, pageSize: 25 });
    mocks.softDeleteUser.mockRejectedValue(new Error('Last admin.'));
    const view = await renderList();
    await flush();

    await click(deleteButton(view.container));
    await flush();

    expect(window.alert).toHaveBeenCalledWith('Last admin.');
    await view.unmount();
  });

  it('ignores a listing that outlives the page', async () => {
    let resolveList!: (value: unknown) => void;
    mocks.listUsers.mockReturnValue(new Promise((resolve) => (resolveList = resolve)));
    const view = await renderList();
    await view.unmount();

    resolveList({ items: [], total: 0, page: 1, pageSize: 25 });
    await flush();
  });

  it('ignores a listing failure that outlives the page', async () => {
    let rejectList!: (reason: unknown) => void;
    mocks.listUsers.mockReturnValue(new Promise((_resolve, reject) => (rejectList = reject)));
    const view = await renderList();
    await view.unmount();

    rejectList(new Error('Users are down.'));
    await flush();
  });

  it('falls back to its own message when a delete fails without one', async () => {
    mocks.listUsers.mockResolvedValue({ items: [user()], total: 1, page: 1, pageSize: 25 });
    mocks.softDeleteUser.mockRejectedValue(undefined);
    const view = await renderList();
    await flush();

    await click(deleteButton(view.container));
    await flush();

    expect(window.alert).toHaveBeenCalledWith('Action failed.');
    await view.unmount();
  });

  it('shows a failure when the list fails to load', async () => {
    mocks.listUsers.mockRejectedValue(new Error('Users are down.'));
    const view = await renderList();
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Users are down.');
    await view.unmount();
  });

  it('still lists users when tier names fail to load, falling back to ids', async () => {
    mocks.listTiers.mockRejectedValue(new Error('Tiers are down.'));
    mocks.listUsers.mockResolvedValue({
      items: [user({ tierId: 'tier-9' }), user({ id: 'user-2', username: 'bob', tierId: null })],
      total: 2,
      page: 1,
      pageSize: 25,
    });
    const view = await renderList();
    await flush();

    expect(view.container.textContent).toContain('tier-9');
    expect(view.container.textContent).toContain('ana');
    expect(view.container.querySelector('.error-text')).toBeNull();
    await view.unmount();
  });

  it('resolves tier names when the tier list loads', async () => {
    mocks.listTiers.mockResolvedValue([tier()]);
    mocks.listUsers.mockResolvedValue({
      items: [user({ tierId: 'tier-1' })],
      total: 1,
      page: 1,
      pageSize: 25,
    });
    const view = await renderList();
    await flush();

    expect(view.container.textContent).toContain('Pro');
    await view.unmount();
  });
});

describe('user form', () => {
  it('loads the account into the edit form and saves through update', async () => {
    mocks.getUser.mockResolvedValue(
      user({ tag: 'ana-writes', isAdmin: false, tierId: 'tier-1', bio: 'Writes things.' }),
    );
    mocks.listTiers.mockResolvedValue([tier()]);
    const view = await renderFormAt('/users/user-1');
    await flush();

    expect(view.container.textContent).toContain('ana');
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.updateUser).toHaveBeenCalledWith('user-1', {
      isAdmin: false,
      tierId: 'tier-1',
      tag: 'ana-writes',
      bio: 'Writes things.',
    });
    expect(view.container.textContent).toContain('users list');
    await view.unmount();
  });

  it('shows a failure when the account fails to load', async () => {
    mocks.getUser.mockRejectedValue(new Error('User is gone.'));
    const view = await renderFormAt('/users/user-1');
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('User is gone.');
    await view.unmount();
  });

  it('still edits when the tier list fails to load', async () => {
    mocks.listTiers.mockRejectedValue(new Error('Tiers are down.'));
    const view = await renderFormAt('/users/user-1');
    await flush();

    expect(view.container.textContent).toContain('Tiers are down.');
    expect(view.container.querySelector('form')).not.toBeNull();
    await view.unmount();
  });

  it('creates a user with a tag and a tier', async () => {
    mocks.listTiers.mockResolvedValue([tier()]);
    mocks.createUser.mockResolvedValue({ id: 'user-9', recoveryCodes: ['EEEEE-55555'] });
    const view = await renderFormAt('/users/new');
    await flush();

    const [username, password, tag] = Array.from(view.container.querySelectorAll('input'));
    await changeInput(username, 'bob');
    await changeInput(password, 'password123');
    await changeInput(tag, 'bob-writes');
    await changeInput(view.container.querySelector('form select')!, 'tier-1');
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.createUser).toHaveBeenCalledWith({
      username: 'bob',
      password: 'password123',
      tag: 'bob-writes',
      isAdmin: false,
      tierId: 'tier-1',
    });
    await view.unmount();
  });

  it('edits the bio of an existing account', async () => {
    const view = await renderFormAt('/users/user-1');
    await flush();

    await changeInput(view.container.querySelector('form textarea')!, 'Loves maps.');
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.updateUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ bio: 'Loves maps.' }),
    );
    await view.unmount();
  });

  it('asks before creating an admin, and creates nothing on cancel', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    const view = await renderFormAt('/users/new');
    await flush();

    await changeInput(view.container.querySelectorAll('input')[0], 'root');
    await changeInput(view.container.querySelectorAll('input')[1], 'password123');
    await click(view.container.querySelector('input[type="checkbox"]')!);
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(mocks.createUser).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('asks before granting admin to an existing account', async () => {
    const view = await renderFormAt('/users/user-1');
    await flush();

    await click(view.container.querySelector('input[type="checkbox"]')!);
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(mocks.updateUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ isAdmin: true }),
    );
    await view.unmount();
  });

  it('reports a save failure without leaving the form', async () => {
    mocks.createUser.mockRejectedValue(new Error('Username taken.'));
    const view = await renderFormAt('/users/new');
    await flush();

    await changeInput(view.container.querySelectorAll('input')[0], 'ana');
    await changeInput(view.container.querySelectorAll('input')[1], 'password123');
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Username taken.');
    expect(view.container.querySelector('form')).not.toBeNull();
    await view.unmount();
  });

  it('falls back to its own messages when failures carry none', async () => {
    mocks.createUser.mockRejectedValue(undefined);
    const view = await renderFormAt('/users/new');
    await flush();

    await changeInput(view.container.querySelectorAll('input')[0], 'ana');
    await changeInput(view.container.querySelectorAll('input')[1], 'password123');
    await submit(view.container.querySelector('form')!);
    await flush();
    expect(view.container.querySelector('.error-text')?.textContent).toBe('Save failed.');
    await view.unmount();

    mocks.regenerateRecoveryCodes.mockRejectedValue(undefined);
    const edit = await renderFormAt('/users/user-1');
    await flush();
    await click(
      Array.from(edit.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Regenerate recovery codes',
      )!,
    );
    await flush();
    expect(edit.container.querySelector('.error-text')?.textContent).toBe(
      'Failed to regenerate recovery codes.',
    );
    await edit.unmount();
  });

  it('regenerates recovery codes after confirmation and shows them once', async () => {
    mocks.regenerateRecoveryCodes.mockResolvedValue({ recoveryCodes: ['CCCCC-33333'] });
    const view = await renderFormAt('/users/user-1');
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Regenerate recovery codes',
      )!,
    );
    await flush();

    expect(mocks.regenerateRecoveryCodes).toHaveBeenCalledWith('user-1');
    expect(view.container.textContent).toContain('CCCCC-33333');
    await view.unmount();
  });

  it('regenerates nothing when the operator cancels', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    const view = await renderFormAt('/users/user-1');
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Regenerate recovery codes',
      )!,
    );
    await flush();

    expect(mocks.regenerateRecoveryCodes).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('reports a regeneration failure', async () => {
    mocks.regenerateRecoveryCodes.mockRejectedValue(new Error('Vault is locked.'));
    const view = await renderFormAt('/users/user-1');
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Regenerate recovery codes',
      )!,
    );
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Vault is locked.');
    await view.unmount();
  });

  it('copies the recovery codes to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    mocks.regenerateRecoveryCodes.mockResolvedValue({ recoveryCodes: ['CCCCC-33333'] });
    const view = await renderFormAt('/users/user-1');
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Regenerate recovery codes',
      )!,
    );
    await flush();
    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Copy codes',
      )!,
    );
    await flush();

    expect(writeText).toHaveBeenCalledWith('CCCCC-33333');
    expect(view.container.querySelector('.success-text')).not.toBeNull();
    await view.unmount();
  });

  it('says so when copying fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Denied.'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    mocks.regenerateRecoveryCodes.mockResolvedValue({ recoveryCodes: ['CCCCC-33333'] });
    const view = await renderFormAt('/users/user-1');
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Regenerate recovery codes',
      )!,
    );
    await flush();
    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Copy codes',
      )!,
    );
    await flush();

    expect(view.container.querySelector('.success-text')?.textContent).toContain('Could not copy');
    await view.unmount();
  });

  it('leaves the form on cancel and after acknowledging the codes', async () => {
    const view = await renderFormAt('/users/new');
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Cancel',
      )!,
    );
    await flush();
    expect(view.container.textContent).toContain('users list');
    await view.unmount();

    mocks.createUser.mockResolvedValue({ id: 'user-9', recoveryCodes: ['DDDDD-44444'] });
    const created = await renderFormAt('/users/new');
    await flush();
    await changeInput(created.container.querySelectorAll('input')[0], 'bob');
    await changeInput(created.container.querySelectorAll('input')[1], 'password123');
    await submit(created.container.querySelector('form')!);
    await flush();
    await click(
      Array.from(created.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Done',
      )!,
    );
    await flush();
    expect(created.container.textContent).toContain('users list');
    await created.unmount();
  });
});
