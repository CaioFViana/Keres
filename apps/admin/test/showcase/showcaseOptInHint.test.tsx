import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ShowcaseApp } from '../../src/showcase/App';
import { flush, render } from '../helpers/react';

/**
 * What the public site tells a signed-in reader who cannot see the adults-only shelf: an unverified account is
 * pointed at signing in, a verified one at the switch in the app profile that turns the shelf on.
 */

const mocks = vi.hoisted(() => ({
  fetchStories: vi.fn(),
  fetchStory: vi.fn(),
  fetchConfig: vi.fn(),
}));

vi.mock('../../src/showcase/api/showcaseApi', () => ({
  fetchStories: mocks.fetchStories,
  fetchStory: mocks.fetchStory,
  unlockStory: vi.fn(),
  fetchDownloadUrl: vi.fn(),
  fetchManuscriptDownloadUrl: vi.fn(),
  fetchConfig: mocks.fetchConfig,
  fetchPacks: vi.fn(),
  fetchPack: vi.fn(),
}));

const viewer = { userId: 'user-1', username: 'ana', tag: 'ana#1', showNsfw: false };
const fetchMock = vi.fn();

const signedIn = (isAdultVerified: boolean) => {
  sessionStorage.setItem('keres_showcase_session', 'abc');
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ ...viewer, isAdultVerified }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ShowcaseApp />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  mocks.fetchStories.mockResolvedValue({ stories: [], etag: null });
  mocks.fetchStory.mockRejectedValue(new Error('Story not found.'));
  mocks.fetchConfig.mockResolvedValue({ showcaseEnabled: true, serverVersion: '1.0.0' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('the adults-only hint on the home page', () => {
  it('sends a verified reader to the profile switch', async () => {
    signedIn(true);
    const view = await renderAt('/');
    await flush();

    expect(view.container.textContent).toContain('Your account is verified');
    await view.unmount();
  });

  it('keeps the plain hint for a reader who is not verified', async () => {
    signedIn(false);
    const view = await renderAt('/');
    await flush();

    expect(view.container.textContent).not.toContain('Your account is verified');
    expect(view.container.textContent).toContain('Signed-in verified adults');
    await view.unmount();
  });
});

describe('the hint on a story the reader cannot open', () => {
  it('tells a verified reader that adults-only content is off on the account', async () => {
    signedIn(true);
    const view = await renderAt('/story/story-1');
    await flush();

    expect(view.container.textContent).toContain('Adults-only content is off on your account');
    await view.unmount();
  });

  it('offers the sign-in to a reader who is not verified', async () => {
    signedIn(false);
    const view = await renderAt('/story/story-1');
    await flush();

    expect(view.container.textContent).toContain('Sign in with a verified account');
    await view.unmount();
  });
});
