import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShowcaseStoryDetail } from '@keres/shared';
import { ShowcaseApp } from '../../src/showcase/App';
import { readerStorageKey } from '../../src/showcase/reader/readerBridge';
import { flush, render } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  fetchStory: vi.fn(),
  unlockStory: vi.fn(),
  fetchReaderUrl: vi.fn(),
  fetchConfig: vi.fn(),
  fetchStories: vi.fn(),
}));

vi.mock('../../src/showcase/api/showcaseApi', () => ({
  fetchStory: mocks.fetchStory,
  unlockStory: mocks.unlockStory,
  fetchReaderUrl: mocks.fetchReaderUrl,
  fetchConfig: mocks.fetchConfig,
  fetchStories: mocks.fetchStories,
  fetchDownloadUrl: vi.fn(),
  fetchManuscriptDownloadUrl: vi.fn(),
  fetchPacks: vi.fn(),
  fetchPack: vi.fn(),
}));

const version = (id: string, label: string, reader: { byteSize: number } | null) => ({
  id,
  label,
  byteSize: 1024,
  mediaIncluded: 0,
  mediaTotal: 0,
  createdAt: '2026-08-19T10:00:00.000Z',
  manuscript: null,
  reader,
});

const detail: ShowcaseStoryDetail = {
  storyId: 'story-1',
  snapshot: {
    title: 'O Vale Silencioso',
    description: null,
    genre: null,
    language: 'pt-BR',
    author: null,
    type: 'branching',
    theme: 'twilight',
  },
  owner: { username: 'ana', tag: '1234', avatarColor: null, avatarIcon: null },
  versions: [version('pub-2', 'v2', { byteSize: 900 }), version('pub-1', 'v1', null)],
  updatedAt: '2026-08-19T10:00:00.000Z',
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ShowcaseApp />
    </MemoryRouter>,
  );

/** What the embedded reader would post to this page, as if it came from the frame. */
async function postFrom(frame: HTMLIFrameElement, data: unknown) {
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent('message', { data, source: frame.contentWindow as MessageEventSource }),
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mocks.fetchStory.mockResolvedValue(detail);
  mocks.fetchStories.mockResolvedValue({ stories: [], etag: null });
  mocks.fetchConfig.mockResolvedValue({ showcaseEnabled: true, serverVersion: '1.8.0' });
  mocks.fetchReaderUrl.mockResolvedValue('/api/public/stories/story-1/publications/pub-2/reader');
});

describe('the read-online button', () => {
  it('appears only on the versions that carry a reader, linking to their reading page', async () => {
    const { container, unmount } = await renderAt('/story/story-1');
    await flush();

    const links = [...container.querySelectorAll<HTMLAnchorElement>('.reader-button')];
    expect(links.map((link) => link.textContent)).toEqual(['Read online']);
    expect(links[0].getAttribute('href')).toBe('/story/story-1/read/pub-2');
    await unmount();
  });

  it('is absent when no version has one', async () => {
    mocks.fetchStory.mockResolvedValue({
      ...detail,
      versions: [version('pub-1', 'v1', null)],
    });
    const { container, unmount } = await renderAt('/story/story-1');
    await flush();

    expect(container.querySelector('.reader-button')).toBeNull();
    await unmount();
  });
});

describe('under the /showcase prefix, as it is served', () => {
  const renderUnderPrefix = (path: string) =>
    render(
      <MemoryRouter basename="/showcase" initialEntries={[path]}>
        <ShowcaseApp />
      </MemoryRouter>,
    );

  it('links to the reading page, and back, inside the prefix - never to a bare path', async () => {
    const story = await renderUnderPrefix('/showcase/story/story-1');
    await flush();
    expect(story.container.querySelector('.reader-button')!.getAttribute('href')).toBe(
      '/showcase/story/story-1/read/pub-2',
    );
    await story.unmount();

    const reading = await renderUnderPrefix('/showcase/story/story-1/read/pub-2');
    await flush();
    await flush();
    expect(reading.container.querySelector('.back-link')!.getAttribute('href')).toBe(
      '/showcase/story/story-1',
    );
    expect(reading.container.querySelector('iframe.reader-frame')).not.toBeNull();
    await reading.unmount();
  });

  it('keeps every link of the story page inside the prefix', async () => {
    const { container, unmount } = await renderUnderPrefix('/showcase/story/story-1');
    await flush();

    const hrefs = [...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')!);
    const local = hrefs.filter((href) => href.startsWith('/') && !href.startsWith('/showcase'));
    expect(local).toEqual([]);
    await unmount();
  });
});

describe('the reading page', () => {
  it('embeds the reader sandboxed, with scripts and nothing else', async () => {
    const { container, unmount } = await renderAt('/story/story-1/read/pub-2');
    await flush();
    await flush();

    const frame = container.querySelector<HTMLIFrameElement>('iframe.reader-frame')!;
    expect(mocks.fetchReaderUrl).toHaveBeenCalledWith('story-1', 'pub-2');
    expect(frame.getAttribute('src')).toBe('/api/public/stories/story-1/publications/pub-2/reader');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(frame.getAttribute('title')).toBe('Reading O Vale Silencioso');
    expect(container.querySelector('.reader-title')?.textContent).toContain('v2');
    expect(container.querySelector<HTMLAnchorElement>('.back-link')!.getAttribute('href')).toBe(
      '/story/story-1',
    );
    await unmount();
  });

  it('says so when the version has no reading, and embeds nothing', async () => {
    const { container, unmount } = await renderAt('/story/story-1/read/pub-1');
    await flush();
    await flush();

    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('.error-text')?.textContent).toBe(
      'This version has no online reading.',
    );
    expect(mocks.fetchReaderUrl).not.toHaveBeenCalled();
    await unmount();
  });

  it('reports a failure to open the reading', async () => {
    mocks.fetchReaderUrl.mockRejectedValue(new Error('Link expired.'));
    const { container, unmount } = await renderAt('/story/story-1/read/pub-2');
    await flush();
    await flush();

    expect(container.querySelector('.error-text')?.textContent).toBe('Link expired.');
    await unmount();
  });

  it('asks a protected story for its password, then opens the reading', async () => {
    mocks.fetchStory.mockResolvedValue({ storyId: 'story-1', protected: true });
    mocks.unlockStory.mockResolvedValue(detail);
    const { container, unmount } = await renderAt('/story/story-1/read/pub-2');
    await flush();

    expect(container.querySelector('iframe')).toBeNull();
    const form = container.querySelector('form')!;
    const input = form.querySelector('input')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'hunter2');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();
    await flush();

    expect(mocks.unlockStory).toHaveBeenCalledWith('story-1', 'hunter2');
    expect(container.querySelector('iframe.reader-frame')).not.toBeNull();
    await unmount();
  });
});

describe('the saves the reader asks for', () => {
  const key = readerStorageKey('story-1', 'pub-2');
  const save = {
    id: 'm1',
    kind: 'manual',
    name: 'Before the vault',
    at: '2026-09-28T10:00:00.000Z',
    scene: 'Cellar',
    count: 1,
    steps: [{ s: 'a', c: null }],
  };

  async function open() {
    const view = await renderAt('/story/story-1/read/pub-2');
    await flush();
    await flush();
    const frame = view.container.querySelector<HTMLIFrameElement>('iframe.reader-frame')!;
    const reply = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => undefined);
    return { ...view, frame, reply };
  }

  it('answers a load with what was kept for this version', async () => {
    window.localStorage.setItem(key, JSON.stringify([save]));
    const { frame, reply, unmount } = await open();

    await postFrom(frame, { keresReader: 1, type: 'load' });

    expect(reply).toHaveBeenCalledWith({ keresReader: 1, type: 'saves', saves: [save] }, '*');
    await unmount();
  });

  it("lends the reader the site's colors when it asks, so it looks part of the page", async () => {
    // jsdom does not resolve custom properties in computed styles: the page's colors are stubbed.
    const site: Record<string, string> = { '--color-bg': '#0e0d13', '--color-primary': '#bb86fc' };
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (name: string) => site[name] ?? '#000000',
    } as unknown as CSSStyleDeclaration);
    const { frame, reply, unmount } = await open();

    await postFrom(frame, { keresReader: 1, type: 'load' });

    expect(reply).toHaveBeenCalledWith(
      {
        keresReader: 1,
        type: 'host',
        palette: expect.objectContaining({ bg: '#0e0d13', accent: '#bb86fc' }),
        scheme: expect.stringMatching(/^(light|dark)$/),
      },
      '*',
    );
    await unmount();
  });

  it('takes the window while reading: one scroll, no footer', async () => {
    const { container, unmount } = await open();

    expect(container.querySelector('.site.site--reading')).not.toBeNull();
    expect(container.querySelector('.site-footer')).toBeNull();
    await unmount();
  });

  it('answers an empty list when nothing was kept', async () => {
    const { frame, reply, unmount } = await open();

    await postFrom(frame, { keresReader: 1, type: 'load' });

    expect(reply).toHaveBeenCalledWith({ keresReader: 1, type: 'saves', saves: [] }, '*');
    await unmount();
  });

  it('keeps a written list, checked and cleaned, under this story version', async () => {
    const { frame, unmount } = await open();

    await postFrom(frame, {
      keresReader: 1,
      type: 'write',
      saves: [{ ...save, evil: '<script>' }, { kind: 'hacked' }],
    });

    expect(JSON.parse(window.localStorage.getItem(key)!)).toEqual([save]);
    expect(window.localStorage.getItem(readerStorageKey('story-1', 'pub-1'))).toBeNull();
    await unmount();
  });

  it('ignores anything that is not a list', async () => {
    const { frame, unmount } = await open();

    await postFrom(frame, { keresReader: 1, type: 'write', saves: 'oops' });

    expect(window.localStorage.getItem(key)).toBeNull();
    await unmount();
  });

  it('answers only the frame it embeds, not any other window', async () => {
    const { reply, unmount } = await open();

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { keresReader: 1, type: 'write', saves: [save] },
          source: window,
        }),
      );
      window.dispatchEvent(
        new MessageEvent('message', { data: { keresReader: 1, type: 'load' }, source: window }),
      );
    });

    expect(window.localStorage.getItem(key)).toBeNull();
    expect(reply).not.toHaveBeenCalled();
    await unmount();
  });

  it('ignores messages of other protocols from the frame', async () => {
    const { frame, reply, unmount } = await open();

    await postFrom(frame, { hello: 'world' });

    expect(reply).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(key)).toBeNull();
    await unmount();
  });
});
