import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShowcaseStoryCard } from '@keres/shared';
import i18n, { ADMIN_LANGUAGE_KEY, SHOWCASE_LANGUAGE_KEY } from '../../src/i18n';
import { LanguageSelect } from '../../src/i18n/LanguageSelect';
import { ShowcaseApp } from '../../src/showcase/App';
import { changeInput, flush, render } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  fetchStories: vi.fn(),
  fetchStory: vi.fn(),
  unlockStory: vi.fn(),
  fetchDownloadUrl: vi.fn(),
  fetchConfig: vi.fn(),
}));

vi.mock('../../src/showcase/api/showcaseApi', () => ({
  fetchStories: mocks.fetchStories,
  fetchStory: mocks.fetchStory,
  unlockStory: mocks.unlockStory,
  fetchDownloadUrl: mocks.fetchDownloadUrl,
  fetchConfig: mocks.fetchConfig,
}));

const card: ShowcaseStoryCard = {
  storyId: 'story-1',
  snapshot: {
    title: 'O Vale Silencioso',
    description: null,
    genre: null,
    language: null,
    author: null,
    type: 'branching',
    theme: null,
  },
  owner: { username: 'ana', tag: 'ana', avatarColor: null, avatarIcon: null },
  versionCount: 1,
  latestVersion: {
    id: 'pub-1',
    label: 'v1-2026-08-19',
    byteSize: 1024,
    mediaIncluded: 0,
    mediaTotal: 0,
    createdAt: '2026-08-19T10:00:00.000Z',
  },
  updatedAt: '2026-08-19T10:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchStories.mockResolvedValue({ stories: [card], etag: null });
  mocks.fetchConfig.mockResolvedValue({ showcaseEnabled: true, serverVersion: '1.0.0' });
});

afterEach(async () => {
  localStorage.removeItem(ADMIN_LANGUAGE_KEY);
  localStorage.removeItem(SHOWCASE_LANGUAGE_KEY);
  await i18n.changeLanguage('en');
});

describe('the language dropdown', () => {
  it('offers every supported language', async () => {
    const { container, unmount } = await render(<LanguageSelect storageKey={ADMIN_LANGUAGE_KEY} />);

    const options = [...container.querySelectorAll('option')].map((option) => option.value);
    expect(options).toEqual(['en', 'pt']);
    await unmount();
  });

  // Names in their own language: someone who cannot read the current one still recognises theirs.
  it('names each language in its own language', async () => {
    const { container, unmount } = await render(<LanguageSelect storageKey={ADMIN_LANGUAGE_KEY} />);

    const labels = [...container.querySelectorAll('option')].map((option) => option.textContent);
    expect(labels).toEqual(['English', 'Português']);
    await unmount();
  });

  it('remembers the choice so the next visit opens in the same language', async () => {
    const { container, unmount } = await render(<LanguageSelect storageKey={ADMIN_LANGUAGE_KEY} />);

    await changeInput(container.querySelector('select')!, 'pt');

    expect(localStorage.getItem(ADMIN_LANGUAGE_KEY)).toBe('pt');
    expect(i18n.language).toBe('pt');
    await unmount();
  });

  // Panel and site keep the choice under separate keys, as is already the case for the theme.
  it('keeps the panel and the site choices apart', async () => {
    const { container, unmount } = await render(
      <LanguageSelect storageKey={SHOWCASE_LANGUAGE_KEY} />,
    );

    await changeInput(container.querySelector('select')!, 'pt');

    expect(localStorage.getItem(SHOWCASE_LANGUAGE_KEY)).toBe('pt');
    expect(localStorage.getItem(ADMIN_LANGUAGE_KEY)).toBeNull();
    await unmount();
  });
});

describe('the showcase in Portuguese', () => {
  it('translates the page when the language changes', async () => {
    const { container, unmount } = await render(
      <MemoryRouter initialEntries={['/']}>
        <ShowcaseApp />
      </MemoryRouter>,
    );
    await flush();
    expect(container.textContent).toContain('Published stories');

    await changeInput(container.querySelector('.language-select')!, 'pt');
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('Histórias publicadas');
    expect(text).toContain('Histórias, abertas.');
    // The author's content stays as it is - translating that would be rewriting the work.
    expect(text).toContain('O Vale Silencioso');
    await unmount();
  });

  it('translates the story type badge, which is data the app defines', async () => {
    const { container, unmount } = await render(
      <MemoryRouter initialEntries={['/']}>
        <ShowcaseApp />
      </MemoryRouter>,
    );
    await flush();
    expect(container.querySelector('.badge')?.textContent).toBe('Branching');

    await changeInput(container.querySelector('.language-select')!, 'pt');
    await flush();

    expect(container.querySelector('.badge')?.textContent).toBe('Ramificada');
    await unmount();
  });
});
