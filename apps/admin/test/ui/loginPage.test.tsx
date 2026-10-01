import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../../src/auth/LoginPage';
import { changeInput, flush, render, submit } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('../../src/auth/AuthContext', () => ({ useAuth: mocks.useAuth }));

/**
 * The gate to the panel. What matters is the sequencing, not the pixels: who is already in goes
 * straight through, a good password lands on the users list, a bad one stays here with the
 * reason on screen.
 */
function renderAtLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/users" element={<p>users page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useAuth.mockReturnValue({
    login: mocks.login,
    isAuthenticated: false,
    isBootstrapping: false,
    username: null,
    logout: vi.fn(),
  });
  mocks.login.mockResolvedValue(undefined);
});

describe('login page', () => {
  it('waits while a persisted session is being re-validated', async () => {
    mocks.useAuth.mockReturnValue({
      login: mocks.login,
      isAuthenticated: false,
      isBootstrapping: true,
      username: null,
      logout: vi.fn(),
    });
    const view = await renderAtLogin();

    expect(view.container.querySelector('.loading-text')).not.toBeNull();
    expect(view.container.querySelector('form')).toBeNull();
    await view.unmount();
  });

  it('sends someone already signed in straight to the users list', async () => {
    mocks.useAuth.mockReturnValue({
      login: mocks.login,
      isAuthenticated: true,
      isBootstrapping: false,
      username: 'admin',
      logout: vi.fn(),
    });
    const view = await renderAtLogin();
    await flush();

    expect(view.container.textContent).toContain('users page');
    await view.unmount();
  });

  it('signs in with the typed credentials and lands on the users list', async () => {
    const view = await renderAtLogin();
    const [username, password] = Array.from(view.container.querySelectorAll('input'));

    await changeInput(username, 'admin');
    await changeInput(password, 'sésamo123');
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.login).toHaveBeenCalledWith('admin', 'sésamo123');
    expect(view.container.textContent).toContain('users page');
    await view.unmount();
  });

  it('stays on the login with the reason when the credentials are wrong', async () => {
    mocks.login.mockRejectedValue(new Error('Invalid credentials.'));
    const view = await renderAtLogin();
    const [username, password] = Array.from(view.container.querySelectorAll('input'));

    await changeInput(username, 'admin');
    await changeInput(password, 'wrong');
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Invalid credentials.');
    expect(view.container.textContent).not.toContain('users page');
    expect(view.container.querySelector('button[type="submit"]')?.textContent).toContain('Sign in');
    await view.unmount();
  });

  it('still says something when the failure carries no message', async () => {
    mocks.login.mockRejectedValue('nope');
    const view = await renderAtLogin();

    await submit(view.container.querySelector('form')!);
    await flush();

    expect(view.container.querySelector('.error-text')).not.toBeNull();
    await view.unmount();
  });
});
