import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '../../src/components/Layout';
import { announceMessagesChanged } from '../../src/api/MessagesApiService';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { click, flush, render } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  useAuth: vi.fn(),
  unreadCount: vi.fn(),
}));

vi.mock('../../src/api/MessagesApiService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/api/MessagesApiService')>()),
  MessagesApiService: { unreadCount: mocks.unreadCount },
}));

vi.mock('../../src/auth/AuthContext', () => ({ useAuth: mocks.useAuth }));

function renderShell(username: string | null = 'admin') {
  mocks.useAuth.mockReturnValue({
    username,
    logout: mocks.logout,
    isAuthenticated: true,
    isBootstrapping: false,
    login: vi.fn(),
  });
  return render(
    <MemoryRouter initialEntries={['/users']}>
      <ThemeProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/users" element={<p>users page</p>} />
          </Route>
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.logout.mockResolvedValue(undefined);
  mocks.unreadCount.mockResolvedValue({ unread: 0 });
});

describe('panel layout', () => {
  it('renders the page inside the shell with its navigation', async () => {
    const view = await renderShell();
    await flush();

    expect(view.container.textContent).toContain('users page');
    for (const link of ['Users', 'Recovery', 'Logs', 'Tiers', 'Messages', 'Settings']) {
      expect(view.container.textContent).toContain(link);
    }
    await view.unmount();
  });

  it('badges Messages with how many still need attention, and follows changes', async () => {
    mocks.unreadCount.mockResolvedValue({ unread: 3 });
    const view = await renderShell();
    await flush();

    const badge = view.container.querySelector('a[href="/messages"] .nav-badge')!;
    expect(badge.textContent).toBe('3');
    expect(badge.getAttribute('aria-label')).toBe('3 unread');

    mocks.unreadCount.mockResolvedValue({ unread: 0 });
    await act(async () => {
      announceMessagesChanged();
    });
    await flush();
    expect(view.container.querySelector('.nav-badge')).toBeNull();
    await view.unmount();
  });

  it('shows no badge, and still renders, when the count cannot be read', async () => {
    mocks.unreadCount.mockRejectedValue(new Error('down'));
    const view = await renderShell();
    await flush();

    expect(view.container.querySelector('.nav-badge')).toBeNull();
    expect(view.container.textContent).toContain('Messages');
    await view.unmount();
  });

  it('opens and closes the navigation on small screens', async () => {
    const view = await renderShell();
    const toggle = view.container.querySelector('.mobile-nav-toggle')!;
    const nav = view.container.querySelector('nav.sidebar')!;

    expect(nav.className).toContain('collapsed');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await click(toggle);
    expect(nav.className).not.toContain('collapsed');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    await click(toggle);
    expect(nav.className).toContain('collapsed');
    await view.unmount();
  });

  it('signs out from the footer', async () => {
    const view = await renderShell();

    await click(
      Array.from(view.container.querySelectorAll('.sidebar-footer button')).find(
        (button) => button.textContent === 'Sign out',
      )!,
    );
    await flush();

    expect(mocks.logout).toHaveBeenCalledOnce();
    await view.unmount();
  });

  it('names who is signed in, or says so when the name is unknown', async () => {
    const named = await renderShell('admin');
    expect(named.container.querySelector('.sidebar-footer span')?.textContent).toBe('admin');
    await named.unmount();

    const unnamed = await renderShell(null);
    expect(unnamed.container.querySelector('.sidebar-footer span')?.textContent).not.toBe('');
    await unnamed.unmount();
  });
});
