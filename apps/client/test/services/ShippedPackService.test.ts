/**
 * @jest-environment node
 */
import { PackContentSchema } from '@keres/shared';
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

const EXPECTED_SLUGS = ['comic', 'novel-craft', 'tabletop-stats'];
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
        return JSON.stringify({
          keys: content.storySchemaFields.map((field) => `${field.entityType}.${field.key}`),
          types: content.storySchemaFields.map((field) => field.type),
          suggestionCount: content.suggestions.length,
          statCount: content.stats.length,
          ladderValues: content.statStrengths.map((tier) => tier.minValue),
          settings: content.settings,
        });
      });
      expect(`${entry.slug}: ${shapes[0]}`).toBe(`${entry.slug}: ${shapes[1]}`);
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
      counts: { stats: 6, customAttributes: 0 },
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
    expect(await createShippedPackService(db).installShippedPack('nope', 'en')).toEqual({
      status: 'not_found',
    });
    expect(await createShippedPackService(db).installShippedPack('comic', 'fr')).toEqual({
      status: 'not_found',
    });
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
