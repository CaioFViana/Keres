import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import siteEn from '../../src/i18n/locales/site.en.json';
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

async function submitForm(form: HTMLFormElement): Promise<void> {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

/**
 * The landing build with a stubbed server: the variant flag is read at module load, so the
 * app is re-imported fresh after stubbing it. Kept in this file (fresh module registry per
 * test file) so the Pages tests keep the default variant.
 */
async function renderLanding() {
  vi.resetModules();
  vi.stubEnv('VITE_SITE_VARIANT', 'landing');
  const { SiteApp } = await import('../../src/App');
  const { render } = await import('../helpers/react');
  const view = await render(<SiteApp />);
  await flush();
  return view;
}

const paidTier = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  name: 'Pro',
  isDefault: false,
  priceMonthlyCents: 1990,
  priceYearlyCents: 19900,
  maxStories: 10,
  maxEntitiesPerStory: null,
  maxEntitiesTotal: 5000,
  maxStorageBytesPerStory: 100 * 1024 * 1024,
  maxStorageBytesTotal: null,
  maxPublicationsPerDay: 5,
};

const freeTier = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FBW',
  name: 'Free',
  isDefault: true,
  priceMonthlyCents: 0,
  priceYearlyCents: null,
  maxStories: 2,
  maxEntitiesPerStory: null,
  maxEntitiesTotal: null,
  maxStorageBytesPerStory: null,
  maxStorageBytesTotal: null,
  maxPublicationsPerDay: 0,
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse({ currency: 'BRL', tiers: [] }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('landing build', () => {
  it('points the hero at this server client and presents the official server', async () => {
    const { container, unmount } = await renderLanding();

    const link = container.querySelector<HTMLAnchorElement>('[data-testid="try-web-client"]')!;
    expect(link.textContent).toBe(siteEn.hero.landingCtaTry);
    expect(link.getAttribute('href')).toBe('/client/');
    expect(container.textContent).toContain(siteEn.hero.landingTryNote);

    const official = container.querySelector('#official')!;
    expect(official.textContent).toContain(siteEn.official.title);
    const hrefs = [...official.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('https://keres.me');
    expect(hrefs).toContain('https://keres.me/client/');

    const navHrefs = [...container.querySelectorAll('#site-nav-links a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(navHrefs).toContain('#tiers');
    expect(navHrefs).toContain('#contact');

    await unmount();
  });

  it('hides the how-it-is-built section and points the showcase answer at /showcase', async () => {
    const { container, unmount } = await renderLanding();

    expect(container.querySelector('#stack')).toBeNull();

    const row = [...container.querySelectorAll('#faq details.faq-item')].find(
      (details) => details.querySelector('summary')?.textContent === siteEn.faq.items.showcase.q,
    );
    expect(row?.querySelector('p')?.textContent).toBe(siteEn.faq.items.showcase.aLanding);
    expect(siteEn.faq.items.showcase.aLanding).toContain('/showcase');

    await unmount();
  });

  it('renders the server tiers with prices, discount and limits', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ currency: 'BRL', tiers: [freeTier, paidTier] }));
    const { container, unmount } = await renderLanding();
    await flush();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public/tiers',
      expect.objectContaining({ headers: { accept: 'application/json' } }),
    );
    const section = container.querySelector('#tiers')!;
    expect(section.textContent).toContain(siteEn.tiers.title);
    // Paid tier: monthly price, discount badge (199.00 vs 12 × 19.90 → −17%).
    expect(section.textContent).toContain('19.90');
    expect(section.textContent).toContain('−17% yearly');
    // Free tier: zero renders as Free, with the default badge.
    expect(section.textContent).toContain('Free');
    expect(section.textContent).toContain(siteEn.tiers.defaultBadge);
    // Limits: a number, unlimited, formatted storage, and zero publications.
    expect(section.textContent).toContain('10');
    expect(section.textContent).toContain('Unlimited');
    expect(section.textContent).toContain('100 MB');
    expect(section.textContent).toContain('None');

    await unmount();
  });

  it('lays every tier card out on the same rows', async () => {
    const unpriced = {
      ...paidTier,
      id: '01ARZ3NDEKTSV4RRFFQ69G5FCX',
      name: 'Enterprise',
      priceMonthlyCents: null,
      priceYearlyCents: null,
    };
    const yearlyOnly = {
      ...paidTier,
      id: '01ARZ3NDEKTSV4RRFFQ69G5FDY',
      name: 'Annual',
      priceMonthlyCents: null,
      priceYearlyCents: 19900,
    };
    fetchMock.mockResolvedValue(
      jsonResponse({ currency: 'BRL', tiers: [freeTier, paidTier, unpriced, yearlyOnly] }),
    );
    const { container, unmount } = await renderLanding();
    await flush();

    const cards = [...container.querySelectorAll('#tiers .tier-card')];
    expect(cards).toHaveLength(4);
    for (const card of cards) {
      expect(card.querySelectorAll('.tier-price')).toHaveLength(1);
      expect(card.querySelectorAll('.tier-subprice')).toHaveLength(1);
      expect(card.querySelectorAll('.tier-limits')).toHaveLength(1);
    }
    // The default card is outlined; the unpriced one links to contact from its hero row.
    expect(container.querySelector('#tiers .tier-card.is-default h3')?.textContent).toContain(
      'Free',
    );
    const cta = container.querySelector('#tiers .tiers-contact a')!;
    expect(cta.className).toContain('button-primary');
    expect(cta.getAttribute('href')).toBe('#contact');
    const custom = [...container.querySelectorAll('#tiers .tier-price a')];
    expect(custom).toHaveLength(1);
    expect(custom[0].getAttribute('href')).toBe('#contact');
    expect(custom[0].textContent).toBe(siteEn.tiers.customPrice);

    await unmount();
  });

  it('says so when the server has no plans for sale', async () => {
    const { container, unmount } = await renderLanding();
    await flush();

    expect(container.querySelector('#tiers')!.textContent).toContain(siteEn.tiers.empty);

    await unmount();
  });

  it('retries loading the tiers after a failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('down'));
    const { container, unmount } = await renderLanding();
    await flush();

    expect(container.querySelector('#tiers')!.textContent).toContain(siteEn.tiers.loadFailed);

    fetchMock.mockResolvedValue(jsonResponse({ currency: 'BRL', tiers: [freeTier] }));
    const retry = [...container.querySelectorAll('#tiers button')].find(
      (button) => button.textContent === siteEn.tiers.retry,
    )!;
    await click(retry);
    await flush();

    expect(container.querySelector('#tiers')!.textContent).toContain('Free');

    await unmount();
  });

  it('sends a contact message to the server', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url === '/api/public/tiers'
          ? jsonResponse({ currency: 'BRL', tiers: [] })
          : jsonResponse({ id: 'msg-1' }, 201),
      ),
    );
    const { container, unmount } = await renderLanding();
    await flush();

    const form = container.querySelector<HTMLFormElement>('#contact form')!;
    const [subject, email] = [...form.querySelectorAll('input')];
    await changeInput(subject, 'Plans');
    await changeInput(email, 'visitor@example.com');
    await changeInput(form.querySelector('textarea')!, 'Do you offer yearly billing?');
    await submitForm(form);
    await flush();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public/contact',
      expect.objectContaining({ method: 'POST' }),
    );
    const sent = fetchMock.mock.calls.find((call) => call[0] === '/api/public/contact')!;
    expect(JSON.parse(sent[1].body)).toEqual({
      subject: 'Plans',
      body: 'Do you offer yearly billing?',
      contactEmail: 'visitor@example.com',
    });
    expect(container.querySelector('#contact')!.textContent).toContain(siteEn.contact.sent);

    await unmount();
  });

  it('spreads the contact form across the full section width', async () => {
    const { container, unmount } = await renderLanding();
    await flush();

    const form = container.querySelector<HTMLFormElement>('#contact form')!;
    // Subject and email stack with a fixed gap in one column, the message fills the other.
    const fields = form.querySelector(':scope > .contact-fields')!;
    expect(fields.querySelector('.contact-subject input[type="text"]')).toBeTruthy();
    expect(fields.querySelector('.contact-email input[type="email"]')).toBeTruthy();
    expect(form.querySelector(':scope > .contact-message textarea')).toBeTruthy();
    expect(form.querySelector(':scope > .contact-actions button[type="submit"]')).toBeTruthy();

    await unmount();
  });

  it('shows the server rejection when contact fails', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url === '/api/public/tiers'
          ? jsonResponse({ currency: 'BRL', tiers: [] })
          : jsonResponse({ message: 'Too many attempts. Try again later.' }, 429),
      ),
    );
    const { container, unmount } = await renderLanding();
    await flush();

    const form = container.querySelector<HTMLFormElement>('#contact form')!;
    const [subject, email] = [...form.querySelectorAll('input')];
    await changeInput(subject, 'Hi');
    await changeInput(email, 'visitor@example.com');
    await changeInput(form.querySelector('textarea')!, 'Hello');
    await submitForm(form);
    await flush();

    expect(container.querySelector('#contact .form-error')?.textContent).toBe(
      'Too many attempts. Try again later.',
    );

    await unmount();
  });
});
