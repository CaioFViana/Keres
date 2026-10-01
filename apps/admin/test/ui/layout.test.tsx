import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '../../src/components/Layout';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { click, flush, render } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  useAuth: vi.fn(),
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
});

describe('panel layout', () => {
  it('renders the page inside the shell with its navigation', async () => {
    const view = await renderShell();
    await flush();

    expect(view.container.textContent).toContain('users page');
    for (const link of ['Users', 'Recovery', 'Logs', 'Tiers', 'Settings']) {
      expect(view.container.textContent).toContain(link);
    }
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
