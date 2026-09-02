/**
 * @jest-environment node
 */
import { createExampleStoryService } from '../../src/services/storymanagement/ExampleStoryService';
import { exampleStoryRegistry } from '../../src/exampleStories/generated/registry';
import {
  CURRENT_STORY_FORMAT_VERSION,
  findStoryExportIntegrityViolations,
  FullStoryExportSchema,
  reviveDates,
  StorySchema,
} from '@keres/shared';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { buildStoryAnalysisReport } from '../../src/utils/storyAnalysisChecks';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  (
    database.db as unknown as {
      transaction: <T>(callback: (tx: typeof database.db) => Promise<T>) => Promise<T>;
    }
  ).transaction = async (callback) => callback(database.db);
});

afterEach(() => database.close());

it('exposes the bundled example catalog and rejects an unknown slug-language pair', async () => {
  const service = createExampleStoryService(database.db);
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  expect(service.listExampleStories().length).toBeGreaterThan(0);
  await expect(
    service.installExampleStory('local-user', 'missing-example', 'pt-BR'),
  ).resolves.toEqual({
    status: 'not_found',
  });
  errorSpy.mockRestore();
});

it('ships every public-domain example as a complete showcase of applicable features', () => {
  for (const entry of exampleStoryRegistry) {
    for (const language of entry.languages) {
      const rawPackage = language.story as Record<string, unknown>;
      const parsed = FullStoryExportSchema.safeParse(reviveDates(language.story));

      expect(parsed.success).toBe(true);
      if (!parsed.success) continue;

      // The schema keeps collections introduced in old versions optional in the type, even though the current
      // format and these guards require all of them in the package.
      const story = parsed.data as any;
      expect(
        Object.keys(FullStoryExportSchema.shape).filter((key) => !(key in rawPackage)),
      ).toEqual([]);
      expect(
        Object.keys(StorySchema.shape).filter(
          (key) => !(key in (rawPackage.story as Record<string, unknown>)),
        ),
      ).toEqual([]);
      expect(story.formatVersion).toBe(CURRENT_STORY_FORMAT_VERSION);
      expect(story.chapters.length).toBeGreaterThanOrEqual(3);
      expect(story.scenes.length).toBeGreaterThanOrEqual(12);
      expect(
        story.scenes.filter((scene: any) => scene.gapType && scene.durationType).length,
      ).toBeGreaterThanOrEqual(Math.ceil(story.scenes.length * 0.8));
      expect(story.characters.length).toBeGreaterThanOrEqual(6);
      expect(story.characterScenes.length).toBeGreaterThanOrEqual(18);
      expect(story.characterRelations.length).toBeGreaterThanOrEqual(6);
      expect(story.locations.length).toBeGreaterThanOrEqual(5);
      expect(story.locationRelations.length).toBeGreaterThanOrEqual(4);
      expect(story.items.length).toBeGreaterThanOrEqual(3);
      expect(story.itemJourneys.length).toBeGreaterThanOrEqual(9);
      expect(story.worldRules.length).toBeGreaterThanOrEqual(3);
      expect(story.notes.length).toBeGreaterThanOrEqual(3);
      expect(story.noteRelations.length).toBeGreaterThanOrEqual(4);
      expect(story.tags.length).toBeGreaterThanOrEqual(4);
      expect(story.tagRelations.length).toBeGreaterThanOrEqual(10);
      expect(story.comments.length).toBeGreaterThanOrEqual(4);
      expect(story.seeAlsoRelations.length).toBeGreaterThanOrEqual(4);
      expect(story.favorites.length).toBeGreaterThanOrEqual(3);
      expect(story.storySchemaFields.length).toBeGreaterThanOrEqual(8);
      expect(story.attributeValues.length).toBeGreaterThanOrEqual(12);
      expect(story.stats.length).toBeGreaterThanOrEqual(5);
      expect(story.statStrengths.length).toBeGreaterThanOrEqual(12);
      expect(story.statRelations.length).toBeGreaterThanOrEqual(20);
      expect(story.modes.length).toBeGreaterThanOrEqual(2);
      expect(story.effects.length).toBeGreaterThanOrEqual(4);
      expect(story.suggestions.length).toBeGreaterThanOrEqual(12);
      expect(story.story.statSystem).toBe(true);

      expect(new Set(story.effects.map((effect: any) => effect.effectType))).toEqual(
        new Set(['itemGrant', 'itemTake', 'triggerSet', 'triggerUnset']),
      );
      const expectedAttributeTypes = [
        'text',
        'long_text',
        'number',
        'boolean',
        'date',
        'suggestion',
        'suggestion_list',
        'entity',
      ];
      const attributeTypes = new Set(story.storySchemaFields.map((field: any) => field.type));
      expectedAttributeTypes.forEach((type) => expect(attributeTypes).toContain(type));
      expect(attributeTypes.has('story_date')).toBe(entry.slug === 'cinderella');
      expect(
        new Set(story.locationRelations.map((relation: any) => relation.relationType)),
      ).toEqual(new Set(['contains', 'connected_to']));
      expect(new Set(story.comments.map((comment: any) => comment.criticality))).toEqual(
        new Set([1, 3, 5]),
      );

      if (story.story.type === 'linear') {
        expect(story.plots.length).toBeGreaterThanOrEqual(4);
        expect(story.plotScenes.length).toBeGreaterThanOrEqual(14);
        expect(
          story.plots.some(
            (plot: any) => !story.plotScenes.some((relation: any) => relation.plotId === plot.id),
          ),
        ).toBe(true);
        expect(story.choices).toHaveLength(0);
        expect(story.choiceCheckGroups).toHaveLength(0);
        expect(story.choiceChecks).toHaveLength(0);
      } else {
        expect(story.plots).toHaveLength(0);
        expect(story.plotScenes).toHaveLength(0);
        expect(story.choices.length).toBeGreaterThanOrEqual(16);
        expect(story.choiceCheckGroups.length).toBeGreaterThanOrEqual(4);
        expect(story.choiceChecks.length).toBeGreaterThanOrEqual(6);
        expect(new Set(story.choiceCheckGroups.map((group: any) => group.combinator))).toEqual(
          new Set(['AND', 'OR']),
        );
        expect(new Set(story.choiceChecks.map((check: any) => check.type))).toEqual(
          new Set(['sceneCount', 'inventory', 'trigger']),
        );
        expect(new Set(story.choiceChecks.map((check: any) => check.mode))).toEqual(
          new Set(['enable', 'block']),
        );
      }
    }
  }
});

it('uses the documented current-feature showcase matrix', () => {
  const packageFor = (slug: string) => {
    const entry = exampleStoryRegistry.find((candidate) => candidate.slug === slug);
    const english = entry?.languages.find((language) => language.language === 'en');
    expect(english).toBeDefined();
    return reviveDates(english!.story) as any;
  };

  for (const entry of exampleStoryRegistry) {
    for (const language of entry.languages) {
      const story = reviveDates(language.story) as any;
      expect(story.galleryItems).toHaveLength(1);
      expect(story.galleryItems[0]).toMatchObject({ mediaType: 'link', mimeType: 'text/uri-list' });
      expect(story.galleryRelations).toHaveLength(1);
      expect(story.galleryRelations[0].galleryId).toBe(story.galleryItems[0].id);
    }
  }

  const alice = packageFor('alice-in-wonderland');
  expect(alice.storyBoards).toHaveLength(1);
  expect(alice.storyBoards[0].content.nodes.some((node: any) => node.kind === 'note')).toBe(true);
  expect(alice.storyBoards[0].content.nodes.some((node: any) => node.kind === 'entity')).toBe(true);

  const beauty = packageFor('beauty-and-the-beast');
  const mermaid = packageFor('little-mermaid');
  [beauty, mermaid].forEach((story) => {
    expect(story.storyLocationMaps).toHaveLength(1);
    expect(story.storyLocationMaps[0].content.nodes.length).toBeGreaterThanOrEqual(5);
  });

  const cinderella = packageFor('cinderella');
  expect(cinderella.storyCalendars).toHaveLength(1);
  expect(cinderella.storyCalendars[0].isPrimary).toBe(true);
  expect(cinderella.chapterAnchors).toHaveLength(2);
  expect(cinderella.story.timelineEpochSeconds).toBeGreaterThan(0);
  expect(cinderella.storySchemaFields.some((field: any) => field.type === 'story_date')).toBe(true);

  const goldilocks = packageFor('goldilocks');
  expect(goldilocks.storyCalendars).toHaveLength(0);
  expect(goldilocks.story.timelineEpochDay).not.toBeNull();
  expect(goldilocks.story.timelineEpochSeconds).toBeGreaterThan(0);

  const kaguya = packageFor('princess-kaguya');
  expect(kaguya.storyCalendars).toHaveLength(1);
  expect(kaguya.storyCalendars[0].isPrimary).toBe(false);
  expect(kaguya.storyCalendars[0].definition.eras).toEqual(
    expect.arrayContaining([expect.objectContaining({ direction: 'backward' })]),
  );
});

/**
 * The counts asserted above say a package is *big* enough; they say nothing about whether its rows
 * agree with one another. That is how the bundled examples came to ship duplicated character
 * relations: every count passed, every row validated, and the graph drew the same pair twice.
 *
 * This runs the same rule both importers run, so a package that would be refused on the way in can
 * never be published in the first place.
 */
it('ships no bundled example that contradicts itself', () => {
  for (const entry of exampleStoryRegistry) {
    for (const language of entry.languages) {
      const violations = findStoryExportIntegrityViolations(
        reviveDates(language.story) as { story: { id: string } },
      );
      expect({
        example: `${entry.slug}/${language.language}`,
        violations: violations.map((violation) => violation.message),
      }).toEqual({ example: `${entry.slug}/${language.language}`, violations: [] });
    }
  }
});

it('keeps example ids valid, unique, referentially sound, bilingual, and bundle-sized', () => {
  const ulid = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
  const collectionNames = Object.keys(exampleStoryRegistry[0].languages[0].story as object).filter(
    (key) =>
      Array.isArray((exampleStoryRegistry[0].languages[0].story as Record<string, unknown>)[key]),
  );

  for (const entry of exampleStoryRegistry) {
    const english = entry.languages.find((language) => language.language === 'en')?.story as Record<
      string,
      any
    >;
    const portuguese = entry.languages.find((language) => language.language === 'pt')
      ?.story as Record<string, any>;
    expect(english).toBeDefined();
    expect(portuguese).toBeDefined();

    for (const collection of collectionNames) {
      expect(portuguese[collection].map((entity: { id: string }) => entity.id)).toEqual(
        english[collection].map((entity: { id: string }) => entity.id),
      );
    }

    for (const language of entry.languages) {
      const story = language.story as Record<string, any>;
      const rowIds = [
        story.story.id,
        ...collectionNames.flatMap((name) => story[name].map((row: { id: string }) => row.id)),
      ];
      expect(rowIds.every((value) => ulid.test(value))).toBe(true);
      expect(new Set(rowIds).size).toBe(rowIds.length);
      expect(
        statSync(
          join(
            process.cwd(),
            'src/exampleStories/content',
            entry.slug,
            `${language.language}.json`,
          ),
        ).size,
      ).toBeLessThan(250 * 1024);

      const ids = (name: string) => new Set(story[name].map((entity: { id: string }) => entity.id));
      const sceneIds = ids('scenes');
      const characterIds = ids('characters');
      const locationIds = ids('locations');
      const itemIds = ids('items');
      const choiceIds = ids('choices');
      const groupIds = ids('choiceCheckGroups');
      const plotIds = ids('plots');
      const fieldIds = ids('storySchemaFields');
      expect(
        story.scenes.every(
          (scene: any) => ids('chapters').has(scene.chapterId) && locationIds.has(scene.locationId),
        ),
      ).toBe(true);
      expect(
        story.characterScenes.every(
          (relation: any) =>
            characterIds.has(relation.characterId) && sceneIds.has(relation.sceneId),
        ),
      ).toBe(true);
      expect(
        story.itemJourneys.every(
          (journey: any) => itemIds.has(journey.itemId) && sceneIds.has(journey.sceneId),
        ),
      ).toBe(true);
      expect(
        story.choices.every(
          (choice: any) => sceneIds.has(choice.sceneId) && sceneIds.has(choice.nextSceneId),
        ),
      ).toBe(true);
      expect(story.choiceCheckGroups.every((group: any) => choiceIds.has(group.choiceId))).toBe(
        true,
      );
      expect(
        story.choiceChecks.every(
          (check: any) =>
            groupIds.has(check.groupId) && (!check.itemId || itemIds.has(check.itemId)),
        ),
      ).toBe(true);
      expect(
        story.plotScenes.every(
          (relation: any) => plotIds.has(relation.plotId) && sceneIds.has(relation.sceneId),
        ),
      ).toBe(true);
      expect(story.attributeValues.every((value: any) => fieldIds.has(value.fieldId))).toBe(true);
    }
  }
});

/**
 * An example arriving 0-based would install a story the Analysis itself flags - and whose first reorder
 * would become a synchronization conflict.
 */
it('numbers every bundled example the way the app does: chapters 1..N, scenes 1..M per chapter', () => {
  for (const entry of exampleStoryRegistry) {
    for (const language of entry.languages) {
      const story = language.story as {
        chapters: { id: string; index: number }[];
        scenes: { chapterId: string; index: number }[];
      };
      const sequential = (indexes: number[]) =>
        [...indexes].sort((a, b) => a - b).every((value, position) => value === position + 1);

      expect(sequential(story.chapters.map((chapter) => chapter.index))).toBe(true);
      for (const chapter of story.chapters) {
        const indexes = story.scenes
          .filter((scene) => scene.chapterId === chapter.id)
          .map((scene) => scene.index);
        expect(sequential(indexes)).toBe(true);
      }
    }
  }
});

it('uses every bundled example as a clean story-analysis reference', async () => {
  for (const entry of exampleStoryRegistry) {
    for (const language of entry.languages) {
      const story = language.story as Record<string, any>;
      const findings = await buildStoryAnalysisReport({
        storyType: story.story.type,
        // Deliberately on, unlike a real story's default: an example is the reference for a
        // well-formed story, so an unused tag or a character in no scene is a defect *here* even
        // though it is a legitimate choice in somebody's own bible. See EXAMPLE_STORIES_PLAN.md.
        includeCompletenessChecks: true,
        characters: story.characters,
        characterScenes: story.characterScenes,
        characterRelations: story.characterRelations,
        locations: story.locations,
        locationRelations: story.locationRelations,
        scenes: story.scenes,
        choices: story.choices,
        choiceCheckGroups: story.choiceCheckGroups,
        choiceChecks: story.choiceChecks,
        effects: story.effects,
        items: story.items,
        itemJourneys: story.itemJourneys,
        tags: story.tags,
        tagRelations: story.tagRelations,
        chapters: story.chapters,
        notes: story.notes,
        worldRules: story.worldRules,
        storySchemaFields: story.storySchemaFields,
        attributeValues: story.attributeValues,
      });
      expect({ example: `${entry.slug}/${language.language}`, findings }).toEqual({
        example: `${entry.slug}/${language.language}`,
        findings: [],
      });
    }
  }
});

it('installs the plots of a linear example bound to the copy, not to the packaged ids', async () => {
  const service = createExampleStoryService(database.db);

  const installed = await service.installExampleStory(
    '01ARZ3NDEKTSV4RRFFQ69G5FAY',
    'cinderella',
    'en',
  );
  expect(installed).toMatchObject({ status: 'installed' });
  if (installed.status !== 'installed') return;

  const packaged = exampleStoryRegistry
    .find((entry) => entry.slug === 'cinderella')
    ?.languages.find((entry) => entry.language === 'en')?.story as { plots: { id: string }[] };
  const plots = await database.db.query.plots.findMany();
  const relations = await database.db.query.plotScenes.findMany();
  const sceneIds = new Set((await database.db.query.scenes.findMany()).map((scene) => scene.id));

  expect(plots.length).toBe(packaged.plots.length);
  expect(plots.every((plot) => plot.storyId === installed.storyId)).toBe(true);
  // The package's ids must not survive the copy, otherwise installing twice collides.
  expect(plots.some((plot) => packaged.plots.some((source) => source.id === plot.id))).toBe(false);

  expect(relations.length).toBeGreaterThan(0);
  expect(
    relations.every(
      (relation) =>
        relation.storyId === installed.storyId &&
        sceneIds.has(relation.sceneId) &&
        plots.some((plot) => plot.id === relation.plotId),
    ),
  ).toBe(true);
});

it('installs the same bundled example as independent local copies', async () => {
  const service = createExampleStoryService(database.db);

  const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAY';
  const first = await service.installExampleStory(userId, 'alice-in-wonderland', 'en');
  const second = await service.installExampleStory(userId, 'alice-in-wonderland', 'en');

  expect(first).toMatchObject({ status: 'installed' });
  expect(second).toMatchObject({ status: 'installed' });
  if (first.status !== 'installed' || second.status !== 'installed') return;

  expect(first.storyId).not.toBe(second.storyId);
  expect((await database.db.query.stories.findMany()).map((story) => story.id)).toEqual(
    expect.arrayContaining([first.storyId, second.storyId]),
  );
});

/**
 * A `Suggestion.type` of `custom:<fieldId>` is a text column that is secretly an id.
 *
 * Until this was fixed, the clone remapped the custom fields and left the catalogue rows pointing at
 * the ids they had inside the package. The field kept working and its suggestions were simply never
 * found - silent, and true of every installed example and every imported `.json`. The 96 packaged
 * rows in that shape are the reason this is asserted over the whole catalogue rather than one case.
 */
it('keeps every custom field reachable from its own suggestion catalogue after installing', async () => {
  const service = createExampleStoryService(database.db);

  const installed = await service.installExampleStory(
    '01ARZ3NDEKTSV4RRFFQ69G5FB0',
    'cinderella',
    'en',
  );
  expect(installed).toMatchObject({ status: 'installed' });
  if (installed.status !== 'installed') return;

  const fields = await database.db.query.storySchemaFields.findMany();
  const stored = await database.db.query.suggestions.findMany();
  const customTypes = stored
    .map((suggestion) => suggestion.type)
    .filter((type) => type.startsWith('custom:'));

  // The example is only a useful witness if it actually ships catalogues for custom fields.
  expect(customTypes.length).toBeGreaterThan(0);

  const liveTypes = new Set(fields.map((field) => `custom:${field.id}`));
  const orphaned = [...new Set(customTypes)].filter((type) => !liveTypes.has(type));

  expect(orphaned).toEqual([]);
});
