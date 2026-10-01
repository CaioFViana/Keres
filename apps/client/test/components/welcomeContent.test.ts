import {
  offersOfficialApp,
  WELCOME_PAGES,
  WELCOME_TITLE_KEYS,
  welcomeHeroIcon,
  welcomeRows,
} from '../../src/components/features/welcome/welcomeContent';
import en from '../../src/locales/en.json';
import pt from '../../src/locales/pt.json';

const FLAVORS = ['native', 'desktop', 'web', 'serverless-web'] as const;

describe('welcome content', () => {
  it('keeps the welcome short: three steps, a few rows each', () => {
    expect(WELCOME_PAGES).toEqual(['what', 'where', 'name']);
    for (const flavor of FLAVORS) {
      for (const page of WELCOME_PAGES) {
        const rows = welcomeRows(page, flavor);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('says the same about what Keres is, and about the name, in every build', () => {
    for (const page of ['what', 'name'] as const) {
      const reference = welcomeRows(page, 'native');
      for (const flavor of FLAVORS) expect(welcomeRows(page, flavor)).toEqual(reference);
    }
  });

  it('tells every build that what is created lives on the device', () => {
    for (const flavor of FLAVORS) {
      const keys = welcomeRows('where', flavor).map((row) => row.textKey);
      expect(
        keys.some((key) => key === 'welcome_where_device' || key === 'welcome_where_browser'),
      ).toBe(true);
    }
  });

  it('tells the browser builds, and only them, that data is kept per site address', () => {
    const keysOf = (flavor: (typeof FLAVORS)[number]) =>
      welcomeRows('where', flavor).map((row) => row.textKey);
    expect(keysOf('web')).toContain('welcome_where_browser');
    expect(keysOf('serverless-web')).toContain('welcome_where_browser');
    expect(keysOf('native')).not.toContain('welcome_where_browser');
    expect(keysOf('desktop')).not.toContain('welcome_where_browser');
  });

  it('explains how to get servers only where there are servers, and the limit where there is one', () => {
    const keysOf = (flavor: (typeof FLAVORS)[number]) =>
      welcomeRows('where', flavor).map((row) => row.textKey);
    for (const flavor of ['native', 'desktop', 'web'] as const) {
      expect(keysOf(flavor)).toContain('welcome_where_servers_how');
    }
    expect(keysOf('serverless-web')).not.toContain('welcome_where_servers_how');
    expect(keysOf('serverless-web')).toContain('welcome_where_serverless');
    expect(keysOf('web')).toContain('welcome_where_web_one_server');
    expect(keysOf('native')).toContain('welcome_where_offline_first');
  });

  it('points only the browser builds at the official apps', () => {
    expect(FLAVORS.filter(offersOfficialApp)).toEqual(['web', 'serverless-web']);
  });

  it("gives every step a picture, the emblem on the first and the build's own device on the second", () => {
    expect(welcomeHeroIcon('what', 'native')).toBe('logo');
    expect(welcomeHeroIcon('name', 'web')).toBe('person-circle-outline');
    expect(welcomeHeroIcon('where', 'native')).toBe('phone-portrait-outline');
    expect(welcomeHeroIcon('where', 'desktop')).toBe('laptop-outline');
    expect(welcomeHeroIcon('where', 'web')).toBe('globe-outline');
    expect(welcomeHeroIcon('where', 'serverless-web')).toBe('cloud-offline-outline');
  });

  it('has every string it uses, in both languages', () => {
    const keys = new Set<string>(Object.values(WELCOME_TITLE_KEYS));
    for (const flavor of FLAVORS)
      for (const page of WELCOME_PAGES)
        for (const row of welcomeRows(page, flavor)) keys.add(row.textKey);
    for (const locale of [en, pt] as Record<string, string>[]) {
      for (const key of keys) expect(locale[key]).toBeTruthy();
    }
  });
});
