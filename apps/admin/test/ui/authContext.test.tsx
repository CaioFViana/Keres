import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../src/auth/AuthContext';
import { click, flush, render } from '../helpers/react';

const mocks = vi.hoisted(() => ({ getToken: vi.fn(), clearToken: vi.fn(), login: vi.fn() }));

vi.mock('../../src/api/apiClient', () => ({
  getToken: mocks.getToken,
  clearToken: mocks.clearToken,
}));
vi.mock('../../src/api/AdminAuthService', () => ({ login: mocks.login }));

function AuthProbe() {
  const auth = useAuth();
  return (
    <div>
      <span>{auth.isAuthenticated ? `signed-in:${auth.username}` : 'signed-out'}</span>
      <button onClick={() => auth.login('admin', 'password')}>Log in</button>
      <button onClick={auth.logout}>Log out</button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getToken.mockReturnValue(null);
  mocks.login.mockResolvedValue({ userId: 'admin-1', username: 'admin' });
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
    expect(mocks.clearToken).toHaveBeenCalledOnce();
    expect(view.container.textContent).toContain('signed-out');
    await view.unmount();
  });

  it('starts authenticated when a persisted token exists', async () => {
    mocks.getToken.mockReturnValue('persisted-token');
    const view = await render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(view.container.textContent).toContain('signed-in:');
    await view.unmount();
  });
});
