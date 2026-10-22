import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { SiteApp } from '../../src/App';
import { FEATURE_GROUPS, PLATFORMS } from '../../src/content/catalog';
import { GITHUB_RELEASES_URL, GITHUB_REPO_URL, WEB_CLIENT_URL } from '../../src/content/links';
import i18n, { SITE_LANGUAGE_KEY } from '../../src/i18n';
import siteEn from '../../src/i18n/locales/site.en.json';
import sitePt from '../../src/i18n/locales/site.pt.json';
import { renderToStaticMarkup } from 'react-dom/server';
import { SITE_THEME_KEY } from '../../src/theme/theme';
import { useSiteTheme } from '../../src/theme/SiteThemeProvider';
import { changeInput, click, render } from '../helpers/react';

afterEach(async () => {
  localStorage.removeItem(SITE_LANGUAGE_KEY);
  localStorage.removeItem(SITE_THEME_KEY);
  await i18n.changeLanguage('en');
});

describe('landing page', () => {
  it('offers the serverless client right in the hero, at the client/ folder beside the page', async () => {
    const { container, unmount } = await render(<SiteApp />);

    const link = container.querySelector<HTMLAnchorElement>('[data-testid="try-web-client"]')!;
    expect(link.querySelector('h3')?.textContent).toBe(siteEn.hero.ctaTry);
    expect(link.getAttribute('href')).toBe(WEB_CLIENT_URL);
    // Under the site's own base path, so it follows the repository name the workflow injects.
    expect(WEB_CLIENT_URL).toBe(`${import.meta.env.BASE_URL}client/`);
    expect(WEB_CLIENT_URL.endsWith('/client/')).toBe(true);
    // What it is, and what it is not: no server, nothing leaves the device.
    expect(container.textContent).toContain(siteEn.hero.tryNote);

    await unmount();
  });

  it('says the same in Portuguese', async () => {
    await i18n.changeLanguage('pt');
    const { container, unmount } = await render(<SiteApp />);

    expect(container.querySelector('[data-testid="try-web-client"] h3')!.textContent).toBe(
      sitePt.hero.ctaTry,
    );
    expect(container.textContent).toContain(sitePt.hero.tryNote);

    await unmount();
  });

  it('renders the English hero and every feature group', async () => {
    const { container, unmount } = await render(<SiteApp />);

    expect(container.textContent).toContain(siteEn.hero.title);
    expect(container.textContent).toContain(siteEn.product.title);
    for (const group of FEATURE_GROUPS) {
      expect(container.textContent).toContain(siteEn.features[group.id].title);
    }
    expect(container.textContent).toContain(siteEn.platforms.title);
    expect(container.textContent).toContain(siteEn.download.title);
    expect(container.textContent).toContain(siteEn.faq.title);
    expect(document.title).toBe(siteEn.meta.title);

    await unmount();
  });

  it('points download and source actions at GitHub', async () => {
    const { container, unmount } = await render(<SiteApp />);
    const hrefs = [...container.querySelectorAll('a')].map((anchor) => anchor.getAttribute('href'));

    expect(hrefs).toContain(GITHUB_REPO_URL);
    expect(hrefs).toContain(GITHUB_RELEASES_URL);
    expect(hrefs).toContain('#download');
    expect(hrefs).toContain('#universe');

    await unmount();
  });

  it('switches the whole page to Portuguese', async () => {
    const { container, unmount } = await render(<SiteApp />);
    const select = container.querySelector('select');
    expect(select).toBeTruthy();

    await changeInput(select!, 'pt');

    expect(container.textContent).toContain(sitePt.hero.title);
    expect(document.title).toBe(sitePt.meta.title);
    expect(document.documentElement.lang).toBe('pt');
    expect(localStorage.getItem(SITE_LANGUAGE_KEY)).toBe('pt');

    await unmount();
  });

  it('cycles the theme preference', async () => {
    const { container, unmount } = await render(<SiteApp />);
    const toggle = [...container.querySelectorAll('button')].find((button) =>
      button.classList.contains('theme-toggle'),
    );
    expect(toggle).toBeTruthy();

    await click(toggle!);
    expect(localStorage.getItem(SITE_THEME_KEY)).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    await click(toggle!);
    expect(localStorage.getItem(SITE_THEME_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    await unmount();
  });

  it('treats an unknown i18n language as English in the selector', async () => {
    await i18n.changeLanguage('fr');
    const { container, unmount } = await render(<SiteApp />);
    const select = container.querySelector('select');
    expect(select?.value).toBe('en');
    await unmount();
  });

  it('follows the operating system while preference stays system', async () => {
    const listeners: Array<() => void> = [];
    const media = {
      matches: false,
      addEventListener: (_type: string, listener: () => void) => {
        listeners.push(listener);
      },
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(media));
    const { unmount } = await render(<SiteApp />);
    media.matches = true;
    await act(async () => {
      for (const listener of listeners) listener();
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    await unmount();
    vi.unstubAllGlobals();
  });

  it('carries no server-backed sections in the Pages build', async () => {
    const { container, unmount } = await render(<SiteApp />);

    expect(container.querySelector('#tiers')).toBeNull();
    expect(container.querySelector('#contact')).toBeNull();
    expect(container.querySelector('#official')).toBeNull();
    const navHrefs = [...container.querySelectorAll('#site-nav-links a')].map((anchor) =>
      anchor.getAttribute('href'),
    );
    expect(navHrefs).not.toContain('#tiers');
    expect(navHrefs).not.toContain('#contact');

    await unmount();
  });

  it('keeps the how-it-is-built section and the project-page answers', async () => {
    const { container, unmount } = await render(<SiteApp />);

    const stack = container.querySelector('#stack');
    expect(stack?.textContent).toContain(siteEn.stack.title);

    const answerOf = (question: string): string | null => {
      const row = [...container.querySelectorAll('#faq details.faq-item')].find(
        (details) => details.querySelector('summary')?.textContent === question,
      );
      return row?.querySelector('p')?.textContent ?? null;
    };
    expect(answerOf(siteEn.faq.items.showcase.q)).toBe(siteEn.faq.items.showcase.a);
    expect(answerOf(siteEn.faq.items.editor.q)).toContain('export');

    await unmount();
  });

  it('renders each feature group as a card whose items are beads, and the platforms as a fork', async () => {
    const { container, unmount } = await render(<SiteApp />);
    const features = siteEn.features as unknown as Record<
      string,
      { title: string; items: Record<string, { title: string; body: string }> }
    >;

    const groups = [...container.querySelectorAll('article.group-card')];
    expect(groups.map((card) => card.querySelector('h3')?.textContent)).toEqual(
      FEATURE_GROUPS.map((group) => features[group.id].title),
    );
    FEATURE_GROUPS.forEach((group, index) => {
      const items = [...groups[index].querySelectorAll('.beads details')];
      expect(items.map((item) => item.querySelector('summary')?.textContent)).toEqual(
        group.items.map((item) => features[group.id].items[item].title),
      );
      // The text of an item is on the page, folded under its title.
      expect(items.map((item) => item.querySelector('p')?.textContent)).toEqual(
        group.items.map((item) => features[group.id].items[item].body),
      );
    });

    // The four groups and the four platforms each sit in a fork that stacks where there is no room for four.
    const forks = [...container.querySelectorAll('[data-thread-fork]')];
    expect(forks.filter((fork) => fork.classList.contains('is-wide'))).toHaveLength(3);
    const platformTitles = siteEn.platforms.items as Record<string, { title: string }>;
    for (const platform of PLATFORMS) {
      expect(container.textContent).toContain(platformTitles[platform].title);
    }

    await unmount();
  });

  it('opens and closes the compact navigation', async () => {
    const { container, unmount } = await render(<SiteApp />);
    const toggle = container.querySelector('.nav-toggle');
    const links = container.querySelector('#site-nav-links');
    expect(toggle).toBeTruthy();
    expect(links?.classList.contains('is-open')).toBe(false);

    await click(toggle!);
    expect(links?.classList.contains('is-open')).toBe(true);

    const firstSection = links?.querySelector('a[href="#product"]');
    expect(firstSection).toBeTruthy();
    await click(firstSection!);
    expect(links?.classList.contains('is-open')).toBe(false);

    await unmount();
  });
});

function ThemeProbe() {
  useSiteTheme();
  return null;
}

describe('theme provider', () => {
  it('throws outside of the provider', () => {
    expect(() => renderToStaticMarkup(<ThemeProbe />)).toThrow(/SiteThemeProvider/);
  });
});
