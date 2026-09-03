import {
  buildStoryBundleFromPacks,
  findPackConflicts,
  type NewStoryData,
} from '../../src/utils/packBundle';

const pack = (overrides: Record<string, unknown> = {}) =>
  ({
    storySchemaFields: [],
    tags: [],
    suggestions: [],
    statStrengths: [],
    stats: [],
    settings: {},
    ...overrides,
  }) as never;

const story = {
  title: 'New story',
  statSystem: false,
  statNotation: 'numeric',
  vocabulary: null,
} as unknown as NewStoryData;

describe('pack bundles', () => {
  it('reports every database-level conflict across selected packs', () => {
    const conflicts = findPackConflicts([
      pack({
        storySchemaFields: [{ entityType: 'Character', key: 'rank' }],
        tags: [{ name: 'Magic' }],
        suggestions: [{ type: 'list', value: 'Fire' }],
        statStrengths: [{ statId: null }],
        stats: Array.from({ length: 8 }, () => ({ isPrimary: true })),
      }),
      pack({
        storySchemaFields: [{ entityType: 'Character', key: 'rank' }],
        tags: [{ name: 'Magic' }],
        suggestions: [{ type: 'list', value: 'Fire' }],
        statStrengths: [{ statId: null }],
        stats: Array.from({ length: 5 }, () => ({ isPrimary: true })),
      }),
    ]);

    expect(conflicts.map((conflict) => conflict.kind).sort()).toEqual([
      'attribute_key',
      'default_ladder',
      'primary_stat_limit',
      'suggestion_value',
      'tag_name',
    ]);
  });

  it('builds an import-shaped clean story with pack rows and no authored relations', () => {
    const bundle = buildStoryBundleFromPacks(story, [
      pack({
        tags: [{ id: 'tag', name: 'Magic' }],
        settings: { statSystem: true, statNotation: 'roman', vocabulary: { version: 1 } },
      }),
    ]);

    expect(bundle.story.id).toBe('PACKSTORYPLACEHOLDER000000');
    expect(bundle.story.version).toBe(1);
    expect(bundle.story.vocabulary).toEqual({ version: 1 });
    expect(bundle.tags).toEqual([{ id: 'tag', name: 'Magic' }]);
    expect(bundle.characterRelations).toEqual([]);
    expect(bundle.attributeValues).toEqual([]);
  });

  it('keeps the first vocabulary seed when more than one pack offers one', () => {
    const bundle = buildStoryBundleFromPacks(story, [
      pack({
        settings: {
          vocabulary: {
            version: 1,
            language: 'en',
            terms: {
              Character: { singular: 'Hero', plural: 'Heroes', grammaticalGender: 'neutral' },
            },
          },
        },
      }),
      pack({
        settings: {
          vocabulary: {
            version: 1,
            language: 'en',
            terms: {
              Character: { singular: 'Actor', plural: 'Actors', grammaticalGender: 'neutral' },
            },
          },
        },
      }),
    ]);
    expect(bundle.story.vocabulary?.terms.Character?.singular).toBe('Hero');
  });
});
