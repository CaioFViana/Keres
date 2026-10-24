/**
 * @jest-environment ./test/helpers/jsdomEnvironment.js
 */
import { setJsdomUrl } from '@/test/helpers/jsdomLocation';
import {
  readShowcaseRequest,
  resetShowcaseRequestCacheForTests,
  showcaseInitialRoute,
} from '@/src/services/showcase/showcaseRequest';

describe('showcaseRequest', () => {
  const originalUrl = window.location.href;

  afterEach(() => {
    setJsdomUrl(originalUrl);
    resetShowcaseRequestCacheForTests();
  });

  function setSearch(search: string) {
    resetShowcaseRequestCacheForTests();
    setJsdomUrl(`${originalUrl.split('?')[0]}${search}`);
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
