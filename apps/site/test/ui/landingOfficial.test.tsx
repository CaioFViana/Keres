// @vitest-environment-options {"url": "https://keres.me/"}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import siteEn from '../../src/i18n/locales/site.en.json';
import sitePt from '../../src/i18n/locales/site.pt.json';

const fetchMock = vi.fn();

/**
 * The landing build opened on keres.me (the environment's URL, above): the variant and the host are read
 * at module load, so the app is re-imported fresh after stubbing the variant.
 */
async function renderOfficial(variant: 'landing' | 'pages' = 'landing') {
  vi.resetModules();
  vi.stubEnv('VITE_SITE_VARIANT', variant);
  const { SiteApp } = await import('../../src/App');
  const { render } = await import('../helpers/react');
  const view = await render(<SiteApp />);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ currency: 'BRL', tiers: [] }),
  } as Response);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('landing build served from keres.me', () => {
  it('is the official site, and speaks of Keres where other landings say "this server"', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SITE_VARIANT', 'landing');
    expect((await import('../../src/variant')).isOfficialSite).toBe(true);

    const { container, unmount } = await renderOfficial();
    const text = container.textContent ?? '';

    expect(text).toContain(siteEn.hero.landingTryNote_official);
    expect(text).not.toContain(siteEn.hero.landingTryNote);
    expect(text).toContain(siteEn.contact.title_official);
    expect(text).toContain(siteEn.contact.lead_official);
    expect(text).toContain(siteEn.tiers.lead_official);
    expect(text).toContain(siteEn.tiers.empty_official);
    expect(text).not.toContain(siteEn.contact.lead);

    const row = [...container.querySelectorAll('#faq details.faq-item')].find(
      (details) => details.querySelector('summary')?.textContent === siteEn.faq.items.showcase.q,
    );
    expect(row?.querySelector('p')?.textContent).toBe(siteEn.faq.items.showcase.aLanding_official);

    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      siteEn.meta.description_official,
    );

    await unmount();
  });

  it('presents itself as the official service, with no link back to itself', async () => {
    const { container, unmount } = await renderOfficial();

    const official = container.querySelector('#official')!;
    expect(official.textContent).toContain(siteEn.official.title_official);
    expect(official.textContent).toContain(siteEn.official.lead_official);

    const links = [...official.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/client/']);
    expect(links[0].textContent).toBe(siteEn.official.openClient_official);
    // Same origin: no new tab.
    expect(links[0].getAttribute('target')).toBeNull();

    await unmount();
  });

  it('is not official when the build is the Pages site, whatever its address', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SITE_VARIANT', 'pages');
    const variant = await import('../../src/variant');

    expect(variant.isOfficialSite).toBe(false);
    expect(variant.SITE_TEXT_CONTEXT).toBeUndefined();
  });

  it('has the official wording in Portuguese as well', () => {
    expect(sitePt.official.title_official).toBeTruthy();
    expect(sitePt.hero.landingTryNote_official).toBeTruthy();
  });
});

describe('which hosts are official', () => {
  it('takes keres.me, with or without www, and nothing that only resembles it', async () => {
    vi.resetModules();
    const { isOfficialHost } = await import('../../src/variant');

    expect(isOfficialHost('keres.me')).toBe(true);
    expect(isOfficialHost('www.keres.me')).toBe(true);
    expect(isOfficialHost('keres.me.evil.example')).toBe(false);
    expect(isOfficialHost('notkeres.me')).toBe(false);
    expect(isOfficialHost('my.keres.me')).toBe(false);
    expect(isOfficialHost('localhost')).toBe(false);
  });
});
