import { getColorLuminance, themes } from '@keres/shared';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShowcaseApp } from '../../src/showcase/App';
import { SHOWCASE_THEME_KEY } from '../../src/showcase/theme/ShowcaseThemeProvider';
import { applyShowcasePalette } from '../../src/showcase/theme/showcasePalette';
import { click, flush, render } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  fetchStories: vi.fn(),
  fetchStory: vi.fn(),
  unlockStory: vi.fn(),
  fetchDownloadUrl: vi.fn(),
  fetchConfig: vi.fn(),
  fetchPacks: vi.fn(),
  fetchPack: vi.fn(),
}));

vi.mock('../../src/showcase/api/showcaseApi', () => ({
  fetchStories: mocks.fetchStories,
  fetchStory: mocks.fetchStory,
  unlockStory: mocks.unlockStory,
  fetchDownloadUrl: mocks.fetchDownloadUrl,
  fetchConfig: mocks.fetchConfig,
  fetchPacks: mocks.fetchPacks,
  fetchPack: mocks.fetchPack,
}));

const brandedConfig = {
  showcaseEnabled: true,
  serverVersion: '1.8.0',
  siteName: 'Acme Stories',
  sitePalette: 'twilight',
  logoUrl: '/api/public/showcase-logo?v=123',
};

function cssVar(name: string): string {
  return document.documentElement.style.getPropertyValue(name);
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ShowcaseApp />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchStories.mockResolvedValue({ stories: [], etag: null });
  mocks.fetchStory.mockResolvedValue({ storyId: 'story-1', protected: true });
  mocks.fetchConfig.mockResolvedValue(brandedConfig);
  mocks.fetchPacks.mockResolvedValue([]);
  mocks.fetchPack.mockRejectedValue(new Error('Not found.'));
});

afterEach(() => {
  applyShowcasePalette('default', 'light');
  localStorage.removeItem(SHOWCASE_THEME_KEY);
  document.documentElement.removeAttribute('data-theme');
  document.title = '';
});

describe('applyShowcasePalette', () => {
  it('paints the site frame with the palette colors of the active mode', () => {
    applyShowcasePalette('twilight', 'light');
    expect(cssVar('--color-primary')).toBe(themes.twilight.lightColors.primary);
    expect(cssVar('--color-bg')).toBe(themes.twilight.lightColors.background);
    expect(cssVar('--color-surface')).toBe(themes.twilight.lightColors.surface);
    expect(cssVar('--color-text')).toBe(themes.twilight.lightColors.text);
    expect(cssVar('--color-accent')).toBe(themes.twilight.lightColors.accent);

    applyShowcasePalette('twilight', 'dark');
    expect(cssVar('--color-primary')).toBe(themes.twilight.darkColors.primary);
    expect(cssVar('--color-bg')).toBe(themes.twilight.darkColors.background);
  });

  it('derives the header, hero and on-primary from the palette', () => {
    applyShowcasePalette('ocean', 'light');
    const colors = themes.ocean.lightColors;

    // The header is the surface translucent; the hero fades from a tinted wash into the background.
    expect(cssVar('--color-header')).toMatch(/^rgba\(/);
    expect(cssVar('--color-hero-to')).toBe(colors.background);
    expect(cssVar('--color-hero-from')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(cssVar('--color-hero-from')).not.toBe(colors.background);
    // Readable text on primary buttons, whatever the palette.
    const gap = Math.abs(
      (getColorLuminance(cssVar('--color-primary')) ?? 0) -
        (getColorLuminance(cssVar('--color-on-primary')) ?? 0),
    );
    expect(gap).toBeGreaterThan(0.4);
  });

  it('writes nothing for the default palette, leaving the original CSS', () => {
    applyShowcasePalette('twilight', 'light');
    expect(cssVar('--color-primary')).not.toBe('');

    applyShowcasePalette('default', 'light');
    expect(cssVar('--color-primary')).toBe('');
    expect(cssVar('--color-header')).toBe('');
    expect(cssVar('--color-hero-from')).toBe('');
    expect(cssVar('--color-on-primary')).toBe('');
  });

  it.each([['from-a-newer-app'], [null], [undefined], ['']])(
    'falls back to the original CSS for an unknown palette (%s)',
    (palette) => {
      applyShowcasePalette(palette, 'dark');

      expect(cssVar('--color-primary')).toBe('');
      expect(cssVar('--color-bg')).toBe('');
    },
  );

  it('never touches the per-story tint variables', () => {
    applyShowcasePalette('twilight', 'light');

    expect(cssVar('--story-primary')).toBe('');
    expect(cssVar('--story-bg')).toBe('');
  });
});

describe('showcase branding', () => {
  it('loads the config once and shows the server version from it', async () => {
    const view = await renderAt('/about');
    await flush();
    await flush();

    expect(mocks.fetchConfig).toHaveBeenCalledTimes(1);
    expect(view.container.textContent).toContain('Server version 1.8.0');
    await view.unmount();
  });

  it('brands the header with the site name and logo', async () => {
    const view = await renderAt('/');
    await flush();
    await flush();

    const header = view.container.querySelector('.site-header')!;
    expect(header.querySelector('.brand-name')?.textContent).toBe('Acme Stories');
    const logo = header.querySelector('img.site-logo')!;
    expect(logo.getAttribute('src')).toBe('/api/public/showcase-logo?v=123');
    await view.unmount();
  });

  it('names the home eyebrow and the document title after the site', async () => {
    const view = await renderAt('/');
    await flush();
    await flush();

    expect(view.container.querySelector('.hero-eyebrow')?.textContent).toBe(
      'Acme Stories Showcase',
    );
    expect(document.title).toBe('Acme Stories — Stories, laid open.');
    await view.unmount();
  });

  it('applies the configured palette to the site frame', async () => {
    const view = await renderAt('/');
    await flush();
    await flush();

    expect(cssVar('--color-primary')).toBe(themes.twilight.lightColors.primary);
    await view.unmount();
  });

  it('re-applies the palette when the resolved theme changes', async () => {
    const view = await renderAt('/');
    await flush();
    await flush();
    expect(cssVar('--color-primary')).toBe(themes.twilight.lightColors.primary);

    const toggle = view.container.querySelector('.theme-toggle')!;
    await click(toggle); // system -> light
    await click(toggle); // light -> dark
    await flush();

    expect(cssVar('--color-primary')).toBe(themes.twilight.darkColors.primary);
    await view.unmount();
  });

  it('keeps the footer on Keres with its disclaimer, branded or not', async () => {
    const branded = await renderAt('/');
    await flush();
    await flush();
    const brandedFooter = branded.container.querySelector('.site-footer')!;
    expect(brandedFooter.querySelector('.brand-name')?.textContent).toBe('Keres');
    expect(brandedFooter.querySelector('.disclaimer')?.textContent).toContain('not affiliated');
    await branded.unmount();

    mocks.fetchConfig.mockRejectedValue(new Error('down'));
    const fallback = await renderAt('/');
    await flush();
    await flush();
    const fallbackFooter = fallback.container.querySelector('.site-footer')!;
    expect(fallbackFooter.querySelector('.brand-name')?.textContent).toBe('Keres');
    expect(fallbackFooter.querySelector('.disclaimer')?.textContent).toContain('not affiliated');
    await fallback.unmount();
  });

  it('falls back to the Keres header, eyebrow and palette when the config cannot be read', async () => {
    mocks.fetchConfig.mockRejectedValue(new Error('down'));
    const view = await renderAt('/');
    await flush();
    await flush();

    const header = view.container.querySelector('.site-header')!;
    expect(header.querySelector('.brand-name')?.textContent).toBe('Keres');
    expect(header.querySelector('img.site-logo')).toBeNull();
    expect(view.container.querySelector('.hero-eyebrow')?.textContent).toBe('Keres Showcase');
    expect(cssVar('--color-primary')).toBe('');
    await view.unmount();
  });

  it('falls back gracefully when the config predates branding fields', async () => {
    mocks.fetchConfig.mockResolvedValue({ showcaseEnabled: true, serverVersion: '1.0.0' });
    const view = await renderAt('/');
    await flush();
    await flush();

    expect(view.container.querySelector('.site-header .brand-name')?.textContent).toBe('Keres');
    expect(view.container.querySelector('.hero-eyebrow')?.textContent).toBe('Keres Showcase');
    expect(cssVar('--color-primary')).toBe('');
    await view.unmount();
  });
});
