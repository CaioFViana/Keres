import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import {
  clearSessionToken,
  fetchViewer,
  login,
  logout,
  readSessionToken,
} from '../../src/showcase/api/showcaseAuth';
import { ShowcaseAuthProvider } from '../../src/showcase/auth/ShowcaseAuthProvider';
import { Layout } from '../../src/showcase/components/Layout';
import { ShowcaseThemeProvider } from '../../src/showcase/theme/ShowcaseThemeProvider';
import { changeInput, click, flush, render, submit } from '../helpers/react';

const viewer = {
  userId: 'user-1',
  username: 'ana',
  tag: 'ana#1',
  isAdultVerified: true,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const fetchMock = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('showcase session requests', () => {
  it('reads the viewer behind a token, or nothing when the token is stale', async () => {
    fetchMock.mockResolvedValueOnce(json(viewer));
    await expect(fetchViewer('token')).resolves.toEqual(viewer);
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', {
      headers: { Authorization: 'Bearer token' },
    });

    fetchMock.mockResolvedValueOnce(json({}, 401));
    await expect(fetchViewer('old')).resolves.toBeNull();
  });

  it('signs in, keeps the token for this tab only, and returns the viewer', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ accessToken: 'abc' }))
      .mockResolvedValueOnce(json(viewer));

    await expect(login('ana', 'secret')).resolves.toEqual(viewer);

    expect(readSessionToken()).toBe('abc');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      username: 'ana',
      password: 'secret',
    });
    clearSessionToken();
    expect(readSessionToken()).toBeNull();
  });

  it('reports the server message of a refused sign-in, or a plain one without it', async () => {
    fetchMock.mockResolvedValueOnce(json({ message: 'Incorrect password.' }, 401));
    await expect(login('ana', 'bad')).rejects.toThrow('Incorrect password.');

    fetchMock.mockResolvedValueOnce(json({ detail: 'x' }, 500));
    await expect(login('ana', 'bad')).rejects.toThrow('Request failed (500).');

    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 502 }));
    await expect(login('ana', 'bad')).rejects.toThrow('Request failed (502).');
    expect(readSessionToken()).toBeNull();
  });

  it('forgets the token when the session cannot be opened right after the sign-in', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ accessToken: 'abc' }))
      .mockResolvedValueOnce(json({}, 401));

    await expect(login('ana', 'secret')).rejects.toThrow('Could not open this session.');
    expect(readSessionToken()).toBeNull();
  });

  it('signs out locally even when the server cannot be reached', async () => {
    sessionStorage.setItem('keres_showcase_session', 'abc');
    fetchMock.mockRejectedValueOnce(new Error('offline'));

    await logout();

    expect(readSessionToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
  });
});

describe('showcase header sign-in', () => {
  const renderHeader = () =>
    render(
      <MemoryRouter>
        <ShowcaseThemeProvider>
          <ShowcaseAuthProvider>
            <Layout>
              <p>page</p>
            </Layout>
          </ShowcaseAuthProvider>
        </ShowcaseThemeProvider>
      </MemoryRouter>,
    );

  const header = (root: HTMLElement) => root.querySelector('.site-nav') as HTMLElement;
  const buttonNamed = (root: HTMLElement, text: string) =>
    Array.from(root.querySelectorAll('button')).find((button) => button.textContent === text)!;

  it('offers to sign in when there is no session, and opens and closes the dialog', async () => {
    const view = await renderHeader();
    await flush();

    await click(buttonNamed(header(view.container), 'Sign in'));
    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();

    // A click inside the card stays; one on the backdrop or Cancel closes it.
    await click(view.container.querySelector('.gate-card h1') as HTMLElement);
    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();
    await click(buttonNamed(view.container, 'Cancel'));
    expect(view.container.querySelector('[role="dialog"]')).toBeNull();

    await click(buttonNamed(header(view.container), 'Sign in'));
    await click(view.container.querySelector('.login-backdrop') as HTMLElement);
    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
    await view.unmount();
  });

  it('signs in from the dialog and shows who is signed in, then signs out', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ accessToken: 'abc' }))
      .mockResolvedValueOnce(json(viewer))
      .mockResolvedValue(json({}));
    const view = await renderHeader();
    await flush();
    await click(buttonNamed(header(view.container), 'Sign in'));

    const [name, password] = Array.from(view.container.querySelectorAll('.gate-card input'));
    await changeInput(name as HTMLInputElement, ' ana ');
    await changeInput(password as HTMLInputElement, 'secret');
    await submit(view.container.querySelector('.gate-card form') as HTMLFormElement);
    await flush();

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).username).toBe('ana');
    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
    expect(header(view.container).textContent).toContain('ana');
    expect(view.container.querySelector('.auth-name')?.getAttribute('title')).toBe('@ana#1');

    await click(buttonNamed(header(view.container), 'Sign out'));
    await flush();
    expect(readSessionToken()).toBeNull();
    expect(buttonNamed(header(view.container), 'Sign in')).toBeDefined();
    await view.unmount();
  });

  it('shows the refusal in the dialog and keeps it open; ignores an empty form', async () => {
    fetchMock.mockResolvedValueOnce(json({ message: 'Incorrect password.' }, 401));
    const view = await renderHeader();
    await flush();
    await click(buttonNamed(header(view.container), 'Sign in'));
    const form = view.container.querySelector('.gate-card form') as HTMLFormElement;

    await submit(form);
    expect(fetchMock).not.toHaveBeenCalled();

    const [name, password] = Array.from(view.container.querySelectorAll('.gate-card input'));
    await changeInput(name as HTMLInputElement, 'ana');
    await changeInput(password as HTMLInputElement, 'bad');
    await submit(form);
    await flush();

    expect(view.container.querySelector('.gate-card .error-text')?.textContent).toBe(
      'Incorrect password.',
    );
    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();
    await view.unmount();
  });

  it('restores a session of this tab, marking an account that is not age-verified', async () => {
    sessionStorage.setItem('keres_showcase_session', 'abc');
    fetchMock.mockResolvedValueOnce(json({ ...viewer, isAdultVerified: false }));
    const view = await renderHeader();
    await flush();

    expect(view.container.querySelector('.auth-name')?.textContent).toContain('not verified');
    await view.unmount();
  });

  it('falls back to anonymous when the saved session is stale or the check fails', async () => {
    sessionStorage.setItem('keres_showcase_session', 'old');
    fetchMock.mockResolvedValueOnce(json({}, 401));
    const stale = await renderHeader();
    await flush();
    expect(buttonNamed(header(stale.container), 'Sign in')).toBeDefined();
    await stale.unmount();

    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const offline = await renderHeader();
    await flush();
    expect(buttonNamed(header(offline.container), 'Sign in')).toBeDefined();
    await offline.unmount();
  });
});
