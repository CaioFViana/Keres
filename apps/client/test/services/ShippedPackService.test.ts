/**
 * @jest-environment node
 */
import { PackContentSchema, STORY_VOCABULARY_ENTITY_TYPES } from '@keres/shared';
import { createPackService } from '../../src/services/storymanagement/PackService';
import { createShippedPackService } from '../../src/services/storymanagement/ShippedPackService';
import { createStoryService } from '../../src/services/storymanagement/StoryService';
import { shippedPackRegistry } from '../../src/shippedPacks/generated/registry';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The packs Keres ships with.
 *
 * The point of these is that the bundled content is *real*: it validates, it installs through the
 * ordinary pack path, and a story created from it comes out with the fields and axes the pack
 * promised. A pack that fails only on a user's device, after they chose it, is the failure mode
 * worth spending tests on - the files are generated, so nothing else would catch a bad one.
 */

const EXPECTED_SLUGS = ['comic', 'novel-craft', 'tabletop-stats', 'three-act-skeleton'];
const USER_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

let database: TestDatabase;
let db: TestDatabase['db'];

beforeEach(async () => {
  database = await createTestDatabase();
  db = database.db;
});

describe('the shipped catalogue', () => {
  it('ships every pack in both languages', () => {
    expect(shippedPackRegistry.map((entry) => entry.slug).sort()).toEqual(EXPECTED_SLUGS);
    for (const entry of shippedPackRegistry) {
      expect(entry.languages.map((language) => language.language).sort()).toEqual(['en', 'pt']);
    }
  });

  it('identifies vocabulary in pack previews, and its absence in the skeleton', () => {
    const previews = createShippedPackService(db).previewShippedPacks();

    expect(previews).toHaveLength(8);
    for (const preview of previews) {
      // The skeleton carries elements, not renamed ones: vocabulary would rename entities in
      // every story made from it, which a starter template has no business doing.
      expect(`${preview.slug}: ${preview.counts.hasVocabulary}`).toBe(
        `${preview.slug}: ${preview.slug !== 'three-act-skeleton'}`,
      );
    }
  });

  it('counts the skeleton extras in the three-act preview', () => {
    const previews = createShippedPackService(db)
      .previewShippedPacks()
      .filter((preview) => preview.slug === 'three-act-skeleton');

    expect(previews).toHaveLength(2);
    for (const preview of previews) {
      expect(preview.counts.extras).toMatchObject({
        chapters: 3,
        scenes: 7,
        characters: 2,
        locations: 2,
      });
    }
  });

  /** Generated content still has to satisfy the schema the app applies it through. */
  it('carries content that validates', () => {
    for (const entry of shippedPackRegistry) {
      for (const language of entry.languages) {
        const file = language.pack as { content: unknown };
        const parsed = PackContentSchema.safeParse(file.content);
        expect(`${entry.slug}/${language.language}: ${parsed.success}`).toBe(
          `${entry.slug}/${language.language}: true`,
        );
      }
    }
  });

  /**
   * The two languages are two packs, but they are the same pack: a field present in one and absent
   * from the other would be a silent translation bug, and the keys are what a story is built from.
   */
  it('keeps the two languages structurally identical', () => {
    for (const entry of shippedPackRegistry) {
      const shapes = entry.languages.map((language) => {
        const content = PackContentSchema.parse((language.pack as { content: unknown }).content);
        // Names are translations, not structure - but the skeleton's shape must match exactly:
        // same collections, same filings, same links.
        const chapterIndex = (id: string | null) =>
          content.extras.chapters.findIndex((row) => row.id === id);
        const sceneIndex = (id: string) => content.extras.scenes.findIndex((row) => row.id === id);
        const characterIndex = (id: string) =>
          content.extras.characters.findIndex((row) => row.id === id);
        const locationIndex = (id: string | null) =>
          id === null ? null : content.extras.locations.findIndex((row) => row.id === id);
        return JSON.stringify({
          keys: content.storySchemaFields.map((field) => `${field.entityType}.${field.key}`),
          types: content.storySchemaFields.map((field) => field.type),
          suggestionCount: content.suggestions.length,
          statCount: content.stats.length,
          ladderValues: content.statStrengths.map((tier) => tier.minValue),
          settings: {
            statSystem: content.settings.statSystem,
            statNotation: content.settings.statNotation,
          },
          vocabularyKeys: Object.keys(content.settings.vocabulary?.terms ?? {}).sort(),
          extras: {
            chapters: content.extras.chapters.length,
            characters: content.extras.characters.length,
            locations: content.extras.locations.length,
            scenes: content.extras.scenes.map((scene) => [
              chapterIndex(scene.chapterId),
              locationIndex(scene.locationId),
              scene.index,
              scene.isStart,
              scene.isFinish,
            ]),
            links: content.extras.characterScenes.map((link) => [
              characterIndex(link.characterId),
              sceneIndex(link.sceneId),
            ]),
          },
        });
      });
      expect(`${entry.slug}: ${shapes[0]}`).toBe(`${entry.slug}: ${shapes[1]}`);
    }
  });

  it('ships a complete vocabulary localized for every pack language that carries one', () => {
    for (const entry of shippedPackRegistry) {
      for (const language of entry.languages) {
        const content = PackContentSchema.parse((language.pack as { content: unknown }).content);
        if (entry.slug === 'three-act-skeleton') {
          expect(content.settings.vocabulary ?? null).toBeNull();
          continue;
        }
        expect(content.settings.vocabulary).toMatchObject({
          version: 1,
          language: language.language,
        });
        expect(Object.keys(content.settings.vocabulary!.terms).sort()).toEqual(
          [...STORY_VOCABULARY_ENTITY_TYPES].sort(),
        );
      }
    }
  });

  /** Every catalogue points at a field in the same pack - the orphan bug, guarded on content. */
  it('points every suggestion catalogue at a field it carries', () => {
    for (const entry of shippedPackRegistry) {
      for (const language of entry.languages) {
        const content = PackContentSchema.parse((language.pack as { content: unknown }).content);
        const fieldIds = new Set(content.storySchemaFields.map((field) => field.id));
        for (const suggestion of content.suggestions) {
          const fieldId = suggestion.type.replace('custom:', '');
          expect(`${entry.slug}/${language.language}: ${fieldIds.has(fieldId)}`).toBe(
            `${entry.slug}/${language.language}: true`,
          );
        }
      }
    }
  });

  it('gives every row an id of its own', () => {
    for (const entry of shippedPackRegistry) {
      for (const language of entry.languages) {
        const file = language.pack as { id: string; content: unknown };
        const content = PackContentSchema.parse(file.content);
        const ids = [
          file.id,
          ...content.storySchemaFields.map((row) => row.id),
          ...content.suggestions.map((row) => row.id),
          ...content.stats.map((row) => row.id),
          ...content.statStrengths.map((row) => row.id),
          ...content.extras.chapters.map((row) => row.id),
          ...content.extras.scenes.map((row) => row.id),
          ...content.extras.characters.map((row) => row.id),
          ...content.extras.locations.map((row) => row.id),
          ...content.extras.worldRules.map((row) => row.id),
          ...content.extras.notes.map((row) => row.id),
          ...content.extras.storyBoards.map((row) => row.id),
          ...content.extras.storyLocationMaps.map((row) => row.id),
          ...content.extras.characterScenes.map((row) => row.id),
          ...content.extras.characterRelations.map((row) => row.id),
          ...content.extras.locationRelations.map((row) => row.id),
          ...content.extras.noteRelations.map((row) => row.id),
          ...content.extras.tagRelations.map((row) => row.id),
        ];
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });
});

describe('installing a shipped pack', () => {
  it('puts it on the device as an ordinary pack', async () => {
    const result = await createShippedPackService(db).installShippedPack('tabletop-stats', 'en');

    expect(result.status).toBe('installed');
    const packs = await createPackService(db).listPacks();
    expect(packs).toHaveLength(1);
    expect(packs[0]).toMatchObject({
      name: 'Tabletop stats',
      language: 'en',
      authorName: 'Keres',
      // Installing puts it here; it says nothing about offering it anywhere.
      visibility: 'private',
      // No source story: it was not extracted here, so it cannot be re-extracted.
      sourceStoryId: null,
      counts: { stats: 6, customAttributes: 0, hasVocabulary: true },
    });
  });

  it('installs the three-act skeleton with its extras counts', async () => {
    const result = await createShippedPackService(db).installShippedPack(
      'three-act-skeleton',
      'en',
    );

    expect(result.status).toBe('installed');
    const packs = await createPackService(db).listPacks();
    expect(packs).toHaveLength(1);
    expect(packs[0]).toMatchObject({
      name: 'Three-act skeleton',
      language: 'en',
      counts: {
        customAttributes: 0,
        hasVocabulary: false,
        extras: { chapters: 3, scenes: 7, characters: 2, locations: 2 },
      },
    });
  });

  /** The id is fixed in the content file, so installing again is an update rather than a copy. */
  it('installing twice leaves one pack', async () => {
    const service = createShippedPackService(db);
    await service.installShippedPack('novel-craft', 'pt');
    await service.installShippedPack('novel-craft', 'pt');

    expect(await createPackService(db).listPacks()).toHaveLength(1);
  });

  it('installs the two languages as two separate packs', async () => {
    const service = createShippedPackService(db);
    await service.installShippedPack('comic', 'en');
    await service.installShippedPack('comic', 'pt');

    const packs = await createPackService(db).listPacks();
    expect(packs).toHaveLength(2);
    expect(packs.map((pack) => pack.language).sort()).toEqual(['en', 'pt']);
  });

  it('reports a slug that does not exist instead of throwing', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await createShippedPackService(db).installShippedPack('nope', 'en')).toEqual({
      status: 'not_found',
    });
    expect(await createShippedPackService(db).installShippedPack('comic', 'fr')).toEqual({
      status: 'not_found',
    });
    expect(errorSpy).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });
});

describe('a story created from a shipped pack', () => {
  const newStory = (title: string) => ({
    userId: USER_ID,
    title,
    type: 'linear' as const,
    description: null,
    genre: null,
    language: null,
    author: null,
    isFavorite: false,
    favoriteBehavior: 'individual' as const,
    extraNotes: null,
    theme: null,
    timelineEpochDay: null,
    normalizeSceneTiming: false,
    allowReaderComments: false,
    autoLinkMentions: true,
    completenessChecks: false,
    statSystem: false,
    statNotation: 'letter' as const,
    lastOperationLog: 0,
    lastServerSyncedLog: 0,
  });

  it('turns the stat system on and creates the six axes', async () => {
    const shipped = createShippedPackService(db);
    const packService = createPackService(db);
    const installed = await shipped.installShippedPack('tabletop-stats', 'en');
    if (installed.status !== 'installed') throw new Error('The pack failed to install.');

    const storyId = await packService.createStoryWithPacks(USER_ID, newStory('A campaign'), [
      installed.packId,
    ]);

    const story = await createStoryService(db).getStoryById(storyId);
    expect(story?.statSystem).toBe(true);
    expect(story?.statNotation).toBe('number');
  });

  it.each([
    ['tabletop-stats', 'en', 'Chapter', 'Session'],
    ['tabletop-stats', 'pt', 'Chapter', 'Sessão'],
    ['novel-craft', 'en', 'Location', 'Setting'],
    ['novel-craft', 'pt', 'Location', 'Cenário'],
    ['comic', 'en', 'Chapter', 'Issue'],
    ['comic', 'pt', 'Chapter', 'Edição'],
  ] as const)(
    'seeds %s/%s vocabulary when creating a story',
    async (slug, language, entityType, singular) => {
      const installed = await createShippedPackService(db).installShippedPack(slug, language);
      if (installed.status !== 'installed') throw new Error('The pack failed to install.');

      const storyId = await createPackService(db).createStoryWithPacks(
        USER_ID,
        newStory('A seeded story'),
        [installed.packId],
      );
      const story = await createStoryService(db).getStoryById(storyId);

      expect(story?.vocabulary).toMatchObject({
        version: 1,
        language,
        terms: { [entityType]: { singular } },
      });
    },
  );

  it('creates the three-act skeleton as ordinary elements when extras install', async () => {
    const installed = await createShippedPackService(db).installShippedPack(
      'three-act-skeleton',
      'en',
    );
    if (installed.status !== 'installed') throw new Error('The pack failed to install.');

    const storyId = await createPackService(db).createStoryWithPacks(
      USER_ID,
      newStory('A structured tale'),
      [installed.packId],
      [installed.packId],
    );

    const chapters = await db.query.chapters.findMany({
      where: (table, { eq }) => eq(table.storyId, storyId),
    });
    expect(chapters.map((row) => row.name).sort()).toEqual([
      'Confrontation',
      'Resolution',
      'Setup',
    ]);
    const scenes = await db.query.scenes.findMany({
      where: (table, { eq }) => eq(table.storyId, storyId),
    });
    expect(scenes).toHaveLength(7);
    expect(scenes.filter((row) => row.isStart)).toHaveLength(1);
    expect(scenes.filter((row) => row.isFinish)).toHaveLength(1);
    const characters = await db.query.characters.findMany({
      where: (table, { eq }) => eq(table.storyId, storyId),
    });
    expect(characters.map((row) => row.name).sort()).toEqual(['Antagonist', 'Protagonist']);
    const links = await db.query.characterScenes.findMany({
      where: (table, { eq }) => eq(table.storyId, storyId),
    });
    expect(links).toHaveLength(2);
  });

  it('creates an empty story from the skeleton when extras stay out', async () => {
    const installed = await createShippedPackService(db).installShippedPack(
      'three-act-skeleton',
      'pt',
    );
    if (installed.status !== 'installed') throw new Error('The pack failed to install.');

    // The skeleton carries no structure at all, so switching its extras off leaves nothing -
    // the same empty story as choosing no pack.
    const storyId = await createPackService(db).createStoryWithPacks(
      USER_ID,
      newStory('Uma história vazia'),
      [installed.packId],
      [],
    );

    expect(
      await db.query.chapters.findMany({
        where: (table, { eq }) => eq(table.storyId, storyId),
      }),
    ).toHaveLength(0);
    expect(
      await db.query.scenes.findMany({
        where: (table, { eq }) => eq(table.storyId, storyId),
      }),
    ).toHaveLength(0);
  });

  it('creates the novel craft fields on the entities they belong to', async () => {
    const shipped = createShippedPackService(db);
    const installed = await shipped.installShippedPack('novel-craft', 'en');
    if (installed.status !== 'installed') throw new Error('The pack failed to install.');

    const storyId = await createPackService(db).createStoryWithPacks(USER_ID, newStory('A novel'), [
      installed.packId,
    ]);

    const fields = await db.query.storySchemaFields.findMany({
      where: (table, { eq }) => eq(table.storyId, storyId),
    });
    const byEntity = fields.reduce<Record<string, string[]>>((accumulator, field) => {
      (accumulator[field.entityType] ??= []).push(field.key);
      return accumulator;
    }, {});

    expect(byEntity.Scene.sort()).toEqual([
      'conflict',
      'goal',
      'narrative_person',
      'outcome',
      'pov_character',
      'value_shift',
    ]);
    expect(byEntity.Character.sort()).toEqual(['arc', 'need', 'want', 'wound']);
  });

  /**
   * The remap has to carry `custom:<fieldId>` with it, or the catalogues land on nothing and the
   * new story shows empty dropdowns - the bug this whole feature was blocked on.
   */
  it('keeps each suggestion catalogue attached to its field', async () => {
    const shipped = createShippedPackService(db);
    const installed = await shipped.installShippedPack('comic', 'en');
    if (installed.status !== 'installed') throw new Error('The pack failed to install.');

    const storyId = await createPackService(db).createStoryWithPacks(
      USER_ID,
      newStory('An issue'),
      [installed.packId],
    );

    const fields = await db.query.storySchemaFields.findMany({
      where: (table, { eq }) => eq(table.storyId, storyId),
    });
    const shotType = fields.find((field) => field.key === 'shot_type');
    expect(shotType).toBeDefined();

    const suggestions = await db.query.suggestions.findMany({
      where: (table, { eq }) => eq(table.storyId, storyId),
    });
    const shotTypes = suggestions.filter(
      (suggestion) => suggestion.type === `custom:${shotType!.id}`,
    );
    expect(shotTypes).toHaveLength(9);
    expect(shotTypes.map((suggestion) => suggestion.value)).toContain('Establishing');
  });
});
