/**
 * @jest-environment ./test/helpers/jsdomEnvironment.js
 */
import { setJsdomUrl } from '@/test/helpers/jsdomLocation';
import {
  readShowcaseRequest,
  resetShowcaseRequestCacheForTests,
  showcaseInitialRoute,
} from '@/src/services/showcase/showcaseRequest';

describe('showcaseRequest branches', () => {
  const originalUrl = window.location.href;

  afterEach(() => {
    setJsdomUrl(originalUrl);
    resetShowcaseRequestCacheForTests();
  });

  function setSearch(search: string) {
    resetShowcaseRequestCacheForTests();
    setJsdomUrl(`${originalUrl.split('?')[0]}${search}`);
  }

  it('returns null when the URL carries no showcase parameter', () => {
    setSearch('?stack=PlotsStack&screen=PlotMatrix');
    expect(readShowcaseRequest()).toBeNull();
  });

  it('applies stack, theme and language defaults', () => {
    setSearch('?showcase=alice-in-wonderland');
    expect(readShowcaseRequest()).toEqual({
      story: 'alice-in-wonderland',
      stack: 'MainDashboard',
      screen: undefined,
      focusName: undefined,
      theme: 'light',
      language: 'en',
    });
  });

  it('reads an explicit dark theme', () => {
    setSearch('?showcase=alice-in-wonderland&theme=dark');
    expect(readShowcaseRequest()).toMatchObject({ theme: 'dark' });
  });

  it('treats any non-dark theme value as light', () => {
    setSearch('?showcase=alice-in-wonderland&theme=sepia');
    expect(readShowcaseRequest()).toMatchObject({ theme: 'light' });
  });

  it('memoizes the parse until the cache is reset', () => {
    setSearch('?showcase=first-story');
    const first = readShowcaseRequest();
    setJsdomUrl(`${originalUrl.split('?')[0]}?showcase=second-story`);
    expect(readShowcaseRequest()).toBe(first);
    resetShowcaseRequestCacheForTests();
    expect(readShowcaseRequest()).toMatchObject({ story: 'second-story' });
  });
});

describe('showcaseInitialRoute fallbacks', () => {
  const originalUrl = window.location.href;

  afterEach(() => {
    setJsdomUrl(originalUrl);
    resetShowcaseRequestCacheForTests();
  });

  function setSearch(search: string) {
    resetShowcaseRequestCacheForTests();
    setJsdomUrl(`${originalUrl.split('?')[0]}${search}`);
  }

  it('keeps the default when there is no showcase request', () => {
    setSearch('');
    expect(showcaseInitialRoute('PlotsStack', 'Plots')).toBe('Plots');
  });

  it('keeps the default when the request targets another stack', () => {
    setSearch('?showcase=story&stack=CharactersStack&screen=CharacterRelationView');
    expect(showcaseInitialRoute('PlotsStack', 'Plots')).toBe('Plots');
  });

  it('keeps the default when the request names no screen', () => {
    setSearch('?showcase=story&stack=PlotsStack');
    expect(showcaseInitialRoute('PlotsStack', 'Plots')).toBe('Plots');
  });

  it('honours a screen of the same stack', () => {
    setSearch('?showcase=story&stack=PlotsStack&screen=PlotMatrix');
    expect(showcaseInitialRoute('PlotsStack', 'Plots')).toBe('PlotMatrix');
  });
});
