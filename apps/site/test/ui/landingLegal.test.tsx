import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import siteEn from '../../src/i18n/locales/site.en.json';
import sitePt from '../../src/i18n/locales/site.pt.json';
import { changeInput, click } from '../helpers/react';

const fetchMock = vi.fn();

function jsonResponse(payload: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => payload } as Response;
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

const terms = {
  version: 2,
  updatedAt: '2026-10-12',
  en: [
    { heading: 'Your account', paragraphs: ['Be kind.', 'Keep it safe.'] },
    { heading: 'Our rights', paragraphs: ['We may remove content.'] },
  ],
  pt: [{ heading: 'Sua conta', paragraphs: ['Seja gentil.'] }],
};

const privacy = {
  version: 1,
  updatedAt: '2026-10-11',
  en: [{ heading: 'What we keep', paragraphs: ['We keep little.'] }],
  pt: [{ heading: 'O que guardamos', paragraphs: ['Guardamos pouco.'] }],
};

function serveLegal(): void {
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/public/tiers')
      return Promise.resolve(jsonResponse({ currency: 'BRL', tiers: [] }));
    if (url === '/api/public/config')
      return Promise.resolve(jsonResponse({ showcaseEnabled: false }));
    if (url === '/api/keres-tos') return Promise.resolve(jsonResponse(terms));
    if (url === '/api/keres-privacy') return Promise.resolve(jsonResponse(privacy));
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

/**
 * The landing build opened at an address: the variant flag is read at module load, so the app is re-imported fresh
 * after stubbing it, and the address bar is set the way a visit would.
 */
async function renderAt(path: string) {
  window.history.replaceState(null, '', path);
  vi.resetModules();
  vi.stubEnv('VITE_SITE_VARIANT', 'landing');
  const { SiteApp } = await import('../../src/App');
  const { render } = await import('../helpers/react');
  const view = await render(<SiteApp />);
  await flush();
  await flush();
  return view;
}

const titles = (container: HTMLElement) =>
  [...container.querySelectorAll('.legal-section h2')].map((heading) => heading.textContent);

beforeEach(() => {
  fetchMock.mockReset();
  serveLegal();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.history.replaceState(null, '', '/');
});

describe('the legal pages of the landing', () => {
  it('shows the terms on a page of their own, every section a knot of the thread', async () => {
    const { container, unmount } = await renderAt('/terms');

    expect(container.querySelector('h1')?.textContent).toBe(siteEn.legal.tabs.terms);
    expect(titles(container)).toEqual(['Your account', 'Our rights']);
    expect(container.querySelector('.legal-body')?.textContent).toContain('Keep it safe.');
    expect(container.querySelectorAll('.legal-section h2[data-thread-knot]')).toHaveLength(2);
    expect(container.querySelector('.legal-version')?.textContent).toBe('Version 2 · 2026-10-12');
    // Only the document of the page is asked for.
    expect(fetchMock).toHaveBeenCalledWith('/api/keres-tos', expect.anything());
    expect(fetchMock).not.toHaveBeenCalledWith('/api/keres-privacy', expect.anything());
    expect(document.title).toBe(`${siteEn.legal.tabs.terms} · Keres`);

    await unmount();
  });

  it('shows the privacy policy at /privacy, with or without a trailing slash', async () => {
    for (const path of ['/privacy', '/privacy/']) {
      const { container, unmount } = await renderAt(path);

      expect(container.querySelector('h1')?.textContent).toBe(siteEn.legal.tabs.privacy);
      expect(titles(container)).toEqual(['What we keep']);
      expect(fetchMock).toHaveBeenCalledWith('/api/keres-privacy', expect.anything());

      await unmount();
    }
  });

  it('links to the other document and back to the start, and its menu points at the landing', async () => {
    const { container, unmount } = await renderAt('/terms');

    const hrefs = [...container.querySelectorAll('#legal .hero-actions a')].map((anchor) => [
      anchor.textContent,
      anchor.getAttribute('href'),
    ]);
    expect(hrefs).toEqual([
      [siteEn.legal.home, '/'],
      [siteEn.legal.tabs.privacy, '/privacy'],
    ]);
    // The sections of the landing are addresses on its root, not on this page.
    const nav = [...container.querySelectorAll('#site-nav-links a')].map((anchor) =>
      anchor.getAttribute('href'),
    );
    expect(nav).toContain('/#product');
    expect(nav).toContain('/#contact');
    expect(container.querySelector('.brand')?.getAttribute('href')).toBe('/');
    expect(container.querySelector('.end a')?.getAttribute('href')).toBe('/#contact');

    await unmount();
  });

  it('is no longer a section of the landing: the footer names each document, the menu has no entry', async () => {
    const { container, unmount } = await renderAt('/');

    expect(container.querySelector('#legal')).toBeNull();
    expect(container.querySelector('.legal-section')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/keres-tos', expect.anything());
    const footer = [...container.querySelectorAll('.footer-links a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(footer).toContain('/terms');
    expect(footer).toContain('/privacy');
    const nav = [...container.querySelectorAll('#site-nav-links a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(nav).not.toContain('#legal');
    expect(nav).toContain('#contact');

    await unmount();
  });

  it.each([
    ['#privacy', '/privacy'],
    ['#terms', '/terms'],
    ['#legal', '/terms'],
  ])('sends the old address /%s to %s', async (hash, destination) => {
    const replace = vi.fn();
    vi.stubGlobal('location', { ...window.location, pathname: '/', hash, replace });
    const { unmount } = await renderAt('/');

    expect(replace).toHaveBeenCalledWith(destination);

    await unmount();
  });

  it('leaves other addresses of the landing where they are', async () => {
    const replace = vi.fn();
    vi.stubGlobal('location', { ...window.location, pathname: '/', hash: '#contact', replace });
    const { unmount } = await renderAt('/');

    expect(replace).not.toHaveBeenCalled();

    await unmount();
  });

  it('says so when the server predates the legal routes', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/public/config')
        return Promise.resolve(jsonResponse({ showcaseEnabled: false }));
      return Promise.resolve(jsonResponse({}, 404));
    });
    const { container, unmount } = await renderAt('/terms');

    expect(container.querySelector('.legal-body')?.textContent).toContain(siteEn.legal.unavailable);

    await unmount();
  });

  it('retries loading the document after a failure', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/public/config')
        return Promise.resolve(jsonResponse({ showcaseEnabled: false }));
      return Promise.reject(new Error('down'));
    });
    const { container, unmount } = await renderAt('/terms');
    expect(container.querySelector('.legal-body')?.textContent).toContain(siteEn.legal.loadFailed);

    serveLegal();
    const retry = [...container.querySelectorAll('.legal-body button')].find(
      (button) => button.textContent === siteEn.legal.retry,
    )!;
    await click(retry);
    await flush();
    await flush();

    expect(titles(container)).toEqual(['Your account', 'Our rights']);

    await unmount();
  });

  it('shows the other language, without a reload, when the site language changes', async () => {
    const { container, unmount } = await renderAt('/terms');
    expect(titles(container)).toEqual(['Your account', 'Our rights']);

    const select = container.querySelector<HTMLSelectElement>('.language-select')!;
    try {
      await changeInput(select, 'pt');
      await flush();
      await flush();

      expect(container.querySelector('h1')?.textContent).toBe(sitePt.legal.tabs.terms);
      expect(titles(container)).toEqual(['Sua conta']);
      expect(container.querySelector('.legal-body')?.textContent).toContain('Seja gentil.');
    } finally {
      await changeInput(select, 'en');
      await flush();
      await flush();
      await unmount();
    }
  });
});

describe('the legal entry of the menu', () => {
  const menuButton = (container: HTMLElement) =>
    container.querySelector<HTMLButtonElement>('.nav-menu-button')!;
  const links = (container: HTMLElement) =>
    [...container.querySelectorAll('.nav-menu-list a')].map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ]);

  it('opens both documents from the header, on the landing and on a legal page', async () => {
    for (const path of ['/', '/privacy']) {
      const { container, unmount } = await renderAt(path);

      expect(menuButton(container).textContent).toBe(siteEn.nav.legal);
      expect(container.querySelector('.nav-menu-list')).toBeNull();
      await click(menuButton(container));
      expect(menuButton(container).getAttribute('aria-expanded')).toBe('true');
      expect(links(container)).toEqual([
        [siteEn.legal.tabs.terms, '/terms'],
        [siteEn.legal.tabs.privacy, '/privacy'],
      ]);

      await unmount();
    }
  });

  it('closes when a document is chosen, when the reader goes elsewhere and on Escape', async () => {
    const { container, unmount } = await renderAt('/');
    const open = async () => {
      if (!container.querySelector('.nav-menu-list')) await click(menuButton(container));
    };

    await open();
    await click(container.querySelector('.nav-menu-list a')!);
    expect(container.querySelector('.nav-menu-list')).toBeNull();

    await open();
    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(container.querySelector('.nav-menu-list')).toBeNull();

    await open();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
    expect(container.querySelector('.nav-menu-list')).not.toBeNull();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(container.querySelector('.nav-menu-list')).toBeNull();

    await unmount();
  });

  it('is not in the project site, which has no legal documents', async () => {
    window.history.replaceState(null, '', '/');
    vi.resetModules();
    vi.stubEnv('VITE_SITE_VARIANT', 'pages');
    const { SiteApp } = await import('../../src/App');
    const { render } = await import('../helpers/react');
    const { container, unmount } = await render(<SiteApp />);

    expect(container.querySelector('.nav-menu')).toBeNull();

    await unmount();
  });
});
