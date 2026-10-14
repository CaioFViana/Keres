import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import siteEn from '../../src/i18n/locales/site.en.json';

/**
 * The plans section in both displays. `info` lists the server's plans with their limits only: no prices,
 * no yearly discount, no call to buy or to ask about pricing, and neutral wording that does not claim
 * anything is for sale. Without the display field (an older server) the section is the sale one.
 */

const fetchMock = vi.fn();

function jsonResponse(payload: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => payload } as Response;
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderLanding() {
  vi.resetModules();
  vi.stubEnv('VITE_SITE_VARIANT', 'landing');
  const { SiteApp } = await import('../../src/App');
  const { render } = await import('../helpers/react');
  const view = await render(<SiteApp />);
  await flush();
  return view;
}

const pro = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  name: 'Pro',
  isDefault: false,
  priceMonthlyCents: 1990,
  priceYearlyCents: 19900,
  maxStories: 10,
  maxEntitiesPerStory: null,
  maxEntitiesTotal: 5000,
  maxStorageBytesPerStory: null,
  maxStorageBytesTotal: null,
  maxPublicationsPerDay: 5,
  maxPublishedArcs: 2,
  maxCommentsPerStory: 20,
  maxContributorsPerStory: 3,
  playMonthlyProductId: 'keres_pro_monthly',
  playYearlyProductId: 'keres_pro_yearly',
  webMonthlyEnabled: true,
  webYearlyEnabled: true,
};

const infoPro = {
  ...pro,
  priceMonthlyCents: null,
  priceYearlyCents: null,
  playMonthlyProductId: null,
  playYearlyProductId: null,
  webMonthlyEnabled: false,
  webYearlyEnabled: false,
};

function serve(payload: unknown) {
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(url === '/api/public/tiers' ? jsonResponse(payload) : jsonResponse({}, 404)),
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('the plans section when the server shows its plans for information only', () => {
  it('has the neutral title and lead, and no sale wording', async () => {
    serve({ currency: 'BRL', display: 'info', tiers: [infoPro] });
    const { container, unmount } = await renderLanding();
    await flush();

    const section = container.querySelector('#tiers')!;
    expect(section.querySelector('h2')?.textContent).toBe(siteEn.tiers.infoTitle);
    expect(section.textContent).toContain(siteEn.tiers.infoLead);
    expect(section.textContent).not.toContain(siteEn.tiers.title);
    // "nothing is sold here" is the one sentence about sales the copy allows; no offer or price wording.
    expect(section.textContent?.toLowerCase()).not.toMatch(/for sale|buy|price|contact us/);

    await unmount();
  });

  it('lists the plans with their name and limits, and no price line', async () => {
    serve({ currency: 'BRL', display: 'info', tiers: [infoPro] });
    const { container, unmount } = await renderLanding();
    await flush();

    const card = container.querySelector('#tiers .tier-card')!;
    expect(card.querySelector('h3')?.textContent).toBe('Pro');
    expect(card.querySelector('.tier-prices')).toBeNull();
    expect(card.textContent).not.toContain(siteEn.tiers.perMonth);
    expect(card.textContent).not.toContain('19.90');
    expect(card.textContent).toContain(siteEn.tiers.stories);
    expect(card.textContent).toContain(siteEn.tiers.commentsPerStory);
    expect(card.textContent).toContain(siteEn.tiers.contributorsPerStory);

    await unmount();
  });

  it('has no call to buy or to ask about pricing', async () => {
    serve({ currency: 'BRL', display: 'info', tiers: [infoPro] });
    const { container, unmount } = await renderLanding();
    await flush();

    const section = container.querySelector('#tiers')!;
    expect(section.textContent).not.toContain(siteEn.tiers.contactCta);
    expect(section.textContent).not.toContain(siteEn.tiers.customPrice);
    expect(section.querySelector('.tiers-contact')).toBeNull();
    expect(section.querySelector('a[href="#contact"]')).toBeNull();

    await unmount();
  });

  it('says no plan is listed when there are none', async () => {
    serve({ currency: 'BRL', display: 'info', tiers: [] });
    const { container, unmount } = await renderLanding();
    await flush();

    const section = container.querySelector('#tiers')!;
    expect(section.textContent).toContain(siteEn.tiers.infoEmpty);
    expect(section.textContent).not.toContain(siteEn.tiers.empty);

    await unmount();
  });
});

describe('the plans section when the server sells its plans', () => {
  it('keeps the sale title, prices and contact call to action', async () => {
    serve({ currency: 'BRL', display: 'sale', tiers: [pro] });
    const { container, unmount } = await renderLanding();
    await flush();

    const section = container.querySelector('#tiers')!;
    expect(section.querySelector('h2')?.textContent).toBe(siteEn.tiers.title);
    expect(section.querySelector('.tier-prices')).not.toBeNull();
    expect(section.textContent).toContain(siteEn.tiers.contactCta);

    await unmount();
  });

  it('reads as sale when the payload has no display field, from an older server', async () => {
    serve({ currency: 'BRL', tiers: [pro] });
    const { container, unmount } = await renderLanding();
    await flush();

    const section = container.querySelector('#tiers')!;
    expect(section.querySelector('h2')?.textContent).toBe(siteEn.tiers.title);
    expect(section.textContent).toContain(siteEn.tiers.contactCta);

    await unmount();
  });
});
