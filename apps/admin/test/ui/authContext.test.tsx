import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../src/auth/AuthContext';
import { SESSION_CLEARED_EVENT } from '../../src/api/apiClient';
import { click, flush, render } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  getStoredUsername: vi.fn(),
  setStoredUsername: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  probeAdminAccess: vi.fn(),
  clearServerSession: vi.fn(),
}));

vi.mock('../../src/api/apiClient', async () => {
  const actual =
    await vi.importActual<typeof import('../../src/api/apiClient')>('../../src/api/apiClient');
  return {
    ...actual,
    getToken: mocks.getToken,
    getStoredUsername: mocks.getStoredUsername,
    setStoredUsername: mocks.setStoredUsername,
  };
});
vi.mock('../../src/api/AdminAuthService', () => ({
  login: mocks.login,
  logout: mocks.logout,
  probeAdminAccess: mocks.probeAdminAccess,
  clearServerSession: mocks.clearServerSession,
}));

function AuthProbe() {
  const auth = useAuth();
  return (
    <div>
      <span>
        {auth.isBootstrapping
          ? 'bootstrapping'
          : auth.isAuthenticated
            ? `signed-in:${auth.username}`
            : 'signed-out'}
      </span>
      <button onClick={() => void auth.login('admin', 'password')}>Log in</button>
      <button onClick={() => void auth.logout()}>Log out</button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getToken.mockReturnValue(null);
  mocks.getStoredUsername.mockReturnValue(null);
  mocks.login.mockResolvedValue({ userId: 'admin-1', username: 'admin' });
  mocks.logout.mockResolvedValue(undefined);
  mocks.probeAdminAccess.mockResolvedValue(undefined);
  mocks.clearServerSession.mockResolvedValue(undefined);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});

describe('admin authentication context', () => {
  it('updates the shared session after a successful login and clears it on logout', async () => {
    const view = await render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    const [loginButton, logoutButton] = Array.from(view.container.querySelectorAll('button'));

    expect(view.container.textContent).toContain('signed-out');
    await click(loginButton);
    await flush();
    expect(mocks.login).toHaveBeenCalledWith('admin', 'password');
    expect(view.container.textContent).toContain('signed-in:admin');

    await click(logoutButton);
    await flush();
    expect(mocks.logout).toHaveBeenCalledOnce();
    expect(view.container.textContent).toContain('signed-out');
    await view.unmount();
  });

  it('restores username and stays signed in after a successful bootstrap probe', async () => {
    mocks.getToken.mockReturnValue('persisted-token');
    mocks.getStoredUsername.mockReturnValue('admin');
    const view = await render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    await flush();
    expect(mocks.probeAdminAccess).toHaveBeenCalledOnce();
    expect(view.container.textContent).toContain('signed-in:admin');
    await view.unmount();
  });

  it('logs out when bootstrap probe fails', async () => {
    mocks.getToken.mockReturnValue('stale-token');
    mocks.getStoredUsername.mockReturnValue('admin');
    mocks.probeAdminAccess.mockRejectedValue(new Error('Unauthorized'));
    const view = await render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    await flush();
    expect(mocks.logout).toHaveBeenCalled();
    expect(view.container.textContent).toContain('signed-out');
    await view.unmount();
  });

  it('reacts to the session-cleared event from the api client', async () => {
    mocks.getToken.mockReturnValue(null);
    const view = await render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    // Simulate a login first via context
    const [loginButton] = Array.from(view.container.querySelectorAll('button'));
    await click(loginButton);
    await flush();
    expect(view.container.textContent).toContain('signed-in:admin');

    await act(async () => {
      window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
    });
    await flush();
    expect(view.container.textContent).toContain('signed-out');
    expect(mocks.clearServerSession).toHaveBeenCalled();
    await view.unmount();
  });
});
