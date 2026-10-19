import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import siteEn from '../../src/i18n/locales/site.en.json';
import sitePt from '../../src/i18n/locales/site.pt.json';
import { changeInput, click } from '../helpers/react';

const fetchMock = vi.fn();
const scrollIntoView = vi.fn();

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
  en: [{ heading: 'Terms', paragraphs: ['Be kind.'] }],
  pt: [{ heading: 'Termos', paragraphs: ['Seja gentil.'] }],
};

const privacy = {
  version: 1,
  updatedAt: '2026-10-11',
  en: [{ heading: 'Privacy', paragraphs: ['We keep little.'] }],
  pt: [{ heading: 'Privacidade', paragraphs: ['Guardamos pouco.'] }],
};

function serveLegal(): void {
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/public/tiers')
      return Promise.resolve(jsonResponse({ currency: 'BRL', tiers: [] }));
    if (url === '/api/keres-tos') return Promise.resolve(jsonResponse(terms));
    if (url === '/api/keres-privacy') return Promise.resolve(jsonResponse(privacy));
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

async function renderLanding() {
  vi.resetModules();
  vi.stubEnv('VITE_SITE_VARIANT', 'landing');
  const { SiteApp } = await import('../../src/App');
  const { render } = await import('../helpers/react');
  const view = await render(<SiteApp />);
  await flush();
  await flush();
  return view;
}

/** The tab that the section marks as selected, by its visible label. */
function selectedTabLabel(container: HTMLElement): string | undefined {
  const tabs = [...container.querySelectorAll('#legal [role="tab"]')];
  return tabs.find((tab) => tab.getAttribute('aria-selected') === 'true')?.textContent ?? undefined;
}

function tabButton(container: HTMLElement, label: string): Element {
  const tab = [...container.querySelectorAll('#legal [role="tab"]')].find(
    (candidate) => candidate.textContent === label,
  );
  if (!tab) throw new Error(`no legal tab labelled ${label}`);
  return tab;
}

/**
 * Sets the address bar the way a link would, without the hashchange that a real link fires.
 * An empty hash is written as the path alone: `replaceState(..., '')` keeps the old fragment.
 */
function setHash(hash: string): void {
  const path = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, '', hash === '' ? path : hash);
}

async function fireHashChange(): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  scrollIntoView.mockReset();
  serveLegal();
  vi.stubGlobal('fetch', fetchMock);
  // jsdom has no layout, so the section cannot be scrolled; the spy records the request instead.
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  setHash('');
});

describe('landing legal section', () => {
  it('renders the terms by default and switches to the privacy tab', async () => {
    const { container, unmount } = await renderLanding();

    const section = container.querySelector('#legal')!;
    expect(section.textContent).toContain(siteEn.legal.title);
    expect(section.textContent).toContain('Terms');
    expect(section.textContent).toContain('Be kind.');
    expect(section.textContent).toContain('2');

    const tabs = [...section.querySelectorAll('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      siteEn.legal.tabs.terms,
      siteEn.legal.tabs.privacy,
    ]);
    await click(tabs[1]);
    await flush();

    expect(section.textContent).toContain('Privacy');
    expect(section.textContent).toContain('We keep little.');
    expect(section.textContent).not.toContain('Be kind.');

    // The Play-listing anchors: the nav entry reaches the section, the footer names each document.
    const navHrefs = [...container.querySelectorAll('#site-nav-links a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(navHrefs).toContain('#legal');
    const footerHrefs = [...container.querySelectorAll('.footer-links a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(footerHrefs).toContain('#terms');
    expect(footerHrefs).toContain('#privacy');
    expect(footerHrefs).not.toContain('#legal');

    await unmount();
  });

  it('says so when the server predates the legal routes', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/public/tiers')
        return Promise.resolve(jsonResponse({ currency: 'BRL', tiers: [] }));
      return Promise.resolve(jsonResponse({}, 404));
    });
    const { container, unmount } = await renderLanding();

    expect(container.querySelector('#legal')!.textContent).toContain(siteEn.legal.unavailable);

    await unmount();
  });

  it('retries loading the documents after a failure', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/public/tiers')
        return Promise.resolve(jsonResponse({ currency: 'BRL', tiers: [] }));
      return Promise.reject(new Error('down'));
    });
    const { container, unmount } = await renderLanding();

    // The documents failed: the section offers a retry.
    expect(container.querySelector('#legal')!.textContent).toContain(siteEn.legal.loadFailed);

    serveLegal();
    const retry = [...container.querySelectorAll('#legal button')].find(
      (button) => button.textContent === siteEn.legal.retry,
    )!;
    await click(retry);
    await flush();
    await flush();

    expect(container.querySelector('#legal')!.textContent).toContain('Be kind.');

    await unmount();
  });

  it('opens the privacy policy and scrolls to it when the page is opened at #privacy', async () => {
    setHash('#privacy');
    const { container, unmount } = await renderLanding();

    expect(selectedTabLabel(container)).toBe(siteEn.legal.tabs.privacy);
    expect(container.querySelector('#legal')!.textContent).toContain('We keep little.');
    expect(scrollIntoView).toHaveBeenCalled();

    await unmount();
  });

  it.each(['#terms', '#legal'])('opens the terms when the page is opened at %s', async (hash) => {
    setHash(hash);
    const { container, unmount } = await renderLanding();

    expect(selectedTabLabel(container)).toBe(siteEn.legal.tabs.terms);
    expect(container.querySelector('#legal')!.textContent).toContain('Be kind.');
    expect(scrollIntoView).toHaveBeenCalled();

    await unmount();
  });

  it('follows the hash while the page is open, and ignores hashes it does not own', async () => {
    const { container, unmount } = await renderLanding();
    expect(selectedTabLabel(container)).toBe(siteEn.legal.tabs.terms);

    setHash('#privacy');
    await fireHashChange();
    expect(selectedTabLabel(container)).toBe(siteEn.legal.tabs.privacy);
    expect(container.querySelector('#legal')!.textContent).toContain('We keep little.');

    setHash('#contact');
    await fireHashChange();
    expect(selectedTabLabel(container)).toBe(siteEn.legal.tabs.privacy);

    setHash('#terms');
    await fireHashChange();
    expect(selectedTabLabel(container)).toBe(siteEn.legal.tabs.terms);
    expect(container.querySelector('#legal')!.textContent).toContain('Be kind.');

    await unmount();
  });

  it('writes the hash when a tab is clicked, without scrolling', async () => {
    const { container, unmount } = await renderLanding();
    expect(scrollIntoView).not.toHaveBeenCalled();

    await click(tabButton(container, siteEn.legal.tabs.privacy));
    await flush();
    expect(window.location.hash).toBe('#privacy');

    await click(tabButton(container, siteEn.legal.tabs.terms));
    await flush();
    expect(window.location.hash).toBe('#terms');

    // replaceState moves the address without jumping the reader to the section.
    expect(scrollIntoView).not.toHaveBeenCalled();

    await unmount();
  });

  it('shows the other language, without a reload, when the site language changes', async () => {
    const { container, unmount } = await renderLanding();
    expect(container.querySelector('#legal')!.textContent).toContain('Be kind.');
    const termsRequests = () =>
      fetchMock.mock.calls.filter(([url]) => url === '/api/keres-tos').length;
    const requestsBefore = termsRequests();

    const select = container.querySelector<HTMLSelectElement>('.language-select')!;
    try {
      await changeInput(select, 'pt');
      await flush();
      await flush();

      const section = container.querySelector('#legal')!;
      expect(section.textContent).toContain(sitePt.legal.title);
      expect(section.textContent).toContain('Seja gentil.');
      expect(section.textContent).not.toContain('Be kind.');
      expect(termsRequests()).toBe(requestsBefore + 1);
    } finally {
      await changeInput(select, 'en');
      await flush();
      await flush();
      await unmount();
    }
  });
});
