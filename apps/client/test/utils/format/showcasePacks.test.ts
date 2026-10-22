import { packMatches, packSummaryChips } from '@/src/utils/format/showcasePacks';

const t = (key: string, options?: Record<string, unknown>) =>
  options?.count !== undefined ? `${key}:${options.count}` : key;

const EMPTY_SUMMARY = {
  fieldCount: 0,
  suggestionCount: 0,
  tagCount: 0,
  statCount: 0,
  hasVocabulary: false,
  statSystem: false,
  statNotation: 'numeric',
  chapterCount: 0,
  sceneCount: 0,
  characterCount: 0,
  locationCount: 0,
  worldRuleCount: 0,
  noteCount: 0,
  boardCount: 0,
  locationMapCount: 0,
} as never;

describe('packSummaryChips', () => {
  it('says nothing of a pack that brings nothing', () => {
    expect(packSummaryChips(EMPTY_SUMMARY, t)).toEqual([]);
  });

  it('says what a pack brings, in the order the app lists it, and only what is there', () => {
    const chips = packSummaryChips(
      {
        ...(EMPTY_SUMMARY as object),
        fieldCount: 2,
        tagCount: 5,
        sceneCount: 3,
        locationMapCount: 1,
        hasVocabulary: true,
      } as never,
      t,
    );

    expect(chips).toEqual([
      'packs_chip_attributes:2',
      'packs_chip_tags:5',
      'packs_chip_scenes:3',
      'packs_chip_maps:1',
      'packs_chip_vocabulary',
    ]);
  });

  it('counts every kind of thing a pack can bring', () => {
    const everything = Object.fromEntries(
      Object.keys(EMPTY_SUMMARY).map((key) => [key, 1]),
    ) as never;
    expect(
      packSummaryChips({ ...(everything as object), hasVocabulary: true } as never, t),
    ).toHaveLength(13);
  });
});

describe('packMatches', () => {
  const pack = { name: 'Tabletop Starter', description: 'For a first campaign', authorName: 'Ana' };

  it('matches everything on an empty search', () => {
    expect(packMatches(pack, '')).toBe(true);
    expect(packMatches(pack, '   ')).toBe(true);
  });

  it('wants every word, in the name, the description or the author, ignoring case', () => {
    expect(packMatches(pack, 'tabletop')).toBe(true);
    expect(packMatches(pack, 'FIRST campaign')).toBe(true);
    expect(packMatches(pack, 'ana starter')).toBe(true);
    expect(packMatches(pack, 'tabletop comic')).toBe(false);
  });

  it('copes with a pack that has no description or author', () => {
    expect(packMatches({ name: 'Bare', description: null, authorName: null }, 'bare')).toBe(true);
    expect(packMatches({ name: 'Bare', description: null, authorName: null }, 'null')).toBe(false);
  });
});
