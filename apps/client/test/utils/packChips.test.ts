import type { PackContentCounts } from '../../src/services/storymanagement/PackService';
import { packExtrasChips } from '../../src/utils/packChips';

const countsOf = (extras: PackContentCounts['extras']): PackContentCounts => ({
  customAttributes: 0,
  suggestions: 0,
  tags: 0,
  stats: 0,
  hasVocabulary: false,
  extras,
});

const t = (key: string, options?: Record<string, unknown>) => `${key}:${options?.['count']}`;

describe('packExtrasChips', () => {
  it('lists each nonzero skeleton collection in reading order', () => {
    expect(
      packExtrasChips(
        countsOf({
          chapters: 2,
          scenes: 0,
          characters: 5,
          locations: 0,
          worldRules: 1,
          notes: 0,
          storyBoards: 0,
          storyLocationMaps: 0,
        }),
        t,
      ),
    ).toEqual(['packs_chip_chapters:2', 'packs_chip_characters:5', 'packs_chip_worldrules:1']);
  });

  it('lists nothing for a schema-only pack', () => {
    expect(
      packExtrasChips(
        countsOf({
          chapters: 0,
          scenes: 0,
          characters: 0,
          locations: 0,
          worldRules: 0,
          notes: 0,
          storyBoards: 0,
          storyLocationMaps: 0,
        }),
        t,
      ),
    ).toEqual([]);
  });
});
