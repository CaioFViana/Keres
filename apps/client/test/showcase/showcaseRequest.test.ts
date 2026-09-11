/**
 * @jest-environment jsdom
 */
import {
  readShowcaseRequest,
  resetShowcaseRequestCacheForTests,
  showcaseInitialRoute,
} from '../../src/showcase/showcaseRequest';

describe('showcaseRequest', () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    resetShowcaseRequestCacheForTests();
  });

  function setSearch(search: string) {
    resetShowcaseRequestCacheForTests();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, search },
    });
  }

  it('reads focusName from the capture URL', () => {
    setSearch(
      '?showcase=beauty-and-the-beast&stack=CharactersStack&screen=CharacterDetail&focus=The%20Beast',
    );
    expect(readShowcaseRequest()).toMatchObject({
      story: 'beauty-and-the-beast',
      stack: 'CharactersStack',
      screen: 'CharacterDetail',
      focusName: 'The Beast',
    });
  });

  it('keeps the character list as the initial route when the capture asks for CharacterDetail', () => {
    setSearch(
      '?showcase=beauty-and-the-beast&stack=CharactersStack&screen=CharacterDetail&focus=The%20Beast',
    );
    expect(showcaseInitialRoute('CharactersStack', 'Characters')).toBe('Characters');
  });

  it('returns nested graph screens when they do not need entity ids', () => {
    setSearch('?showcase=alice-in-wonderland&stack=NarrativeElementsStack&screen=ChoiceView');
    expect(showcaseInitialRoute('NarrativeElementsStack', 'NarrativeElements')).toBe('ChoiceView');
  });
});
