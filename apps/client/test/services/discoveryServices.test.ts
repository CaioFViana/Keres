/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { AttributeType } from '@keres/shared';
import { createGlobalSearchService } from '../../src/services/storymanagement/GlobalSearchService';
import { createStoryAnalysisService } from '../../src/services/storymanagement/StoryAnalysisService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
});

afterEach(() => database.close());

describe('discovery services', () => {
  it('does not search a one-character term and returns live native matches with a useful snippet', async () => {
    await database.db.insert(schema.characters).values([
      { id: 'ada', storyId: TEST_STORY_ID, name: 'Ada Lovelace', ...entityBase },
      {
        id: 'deleted-ada',
        storyId: TEST_STORY_ID,
        name: 'Ada Oculta',
        ...entityBase,
        isDeleted: true,
      },
    ]);
    const service = createGlobalSearchService(database.db);

    expect(await service.searchAllEntities(TEST_STORY_ID, 'a', TEST_USER_ID)).toEqual([]);
    expect(await service.searchAllEntities(TEST_STORY_ID, 'LOVE', TEST_USER_ID)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: 'Character',
          id: 'ada',
          title: 'Ada Lovelace',
          snippet: expect.stringContaining('Ada Lovelace'),
        }),
      ]),
    );
  });

  it('shows a suggestion list in the snippet as a comma-separated line, not JSON', async () => {
    await database.db.insert(schema.characters).values({
      id: 'listed',
      storyId: TEST_STORY_ID,
      name: 'Lista Viva',
      ...entityBase,
    });
    await database.db.insert(schema.storySchemaFields).values({
      id: 'traits',
      storyId: TEST_STORY_ID,
      entityType: 'Character',
      name: 'Traços',
      key: 'tracos',
      type: AttributeType.SUGGESTION_LIST,
      isRequired: false,
      order: 0,
      ...entityBase,
    });
    await database.db.insert(schema.attributeValues).values({
      id: 'listed-traits',
      storyId: TEST_STORY_ID,
      entityType: 'Character',
      entityId: 'listed',
      fieldId: 'traits',
      value: '["elf","dwarf"]',
      ...entityBase,
    });

    const matches = await createGlobalSearchService(database.db).searchAllEntities(
      TEST_STORY_ID,
      'elf',
      TEST_USER_ID,
    );

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'listed',
          snippet: expect.stringContaining('Traços: elf, dwarf'),
        }),
      ]),
    );
    expect(matches.find((match) => match.id === 'listed')?.snippet).not.toContain('[');
  });

  it('turns the data loaded by StoryAnalysisService into structural findings', async () => {
    await database.db.insert(schema.characters).values({
      id: 'isolated',
      storyId: TEST_STORY_ID,
      name: 'Personagem isolado',
      ...entityBase,
    });
    // "Not referenced anywhere" is an opinion, so it is behind the story's own switch. Turning it on
    // here is also what proves the column reaches the checks - the flag travels from this row into
    // `StoryAnalysisInput`, not from a default in the code.
    await database.db
      .update(schema.stories)
      .set({ completenessChecks: true })
      .where(eq(schema.stories.id, TEST_STORY_ID));

    const report = await createStoryAnalysisService(database.db).analyzeStoryFull(TEST_STORY_ID);
    expect(report.generatedAt).toBeInstanceOf(Date);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: 'isolated',
          messageKey: 'analysis_character_no_scenes',
        }),
        expect.objectContaining({
          entityId: 'isolated',
          messageKey: 'analysis_character_no_relationships',
        }),
      ]),
    );
  });

  it('refuses to analyze a story that does not exist', async () => {
    await expect(
      createStoryAnalysisService(database.db).analyzeStoryFull('missing'),
    ).rejects.toThrow('not found for analysis');
  });
});

describe('global search attributes and scene context', () => {
  it('shows a plain custom attribute in the snippet verbatim', async () => {
    await database.db.insert(schema.characters).values({
      id: 'sage',
      storyId: TEST_STORY_ID,
      name: 'Sage',
      ...entityBase,
    });
    await database.db.insert(schema.storySchemaFields).values({
      id: 'title-field',
      storyId: TEST_STORY_ID,
      entityType: 'Character',
      name: 'Title',
      key: 'title',
      type: AttributeType.TEXT,
      isRequired: false,
      order: 0,
      ...entityBase,
    });
    await database.db.insert(schema.attributeValues).values({
      id: 'sage-title',
      storyId: TEST_STORY_ID,
      entityType: 'Character',
      entityId: 'sage',
      fieldId: 'title-field',
      value: 'Keeper of the Harbor',
      ...entityBase,
    });

    const matches = await createGlobalSearchService(database.db).searchAllEntities(
      TEST_STORY_ID,
      'harbor',
      TEST_USER_ID,
    );

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'sage',
          title: 'Sage',
          snippet: expect.stringContaining('Title: Keeper of the Harbor'),
        }),
      ]),
    );
  });

  it('keeps the native match when the same entity also matches through an attribute', async () => {
    await database.db.insert(schema.characters).values({
      id: 'sage',
      storyId: TEST_STORY_ID,
      name: 'Harbor Sage',
      ...entityBase,
    });
    await database.db.insert(schema.storySchemaFields).values({
      id: 'title-field',
      storyId: TEST_STORY_ID,
      entityType: 'Character',
      name: 'Title',
      key: 'title',
      type: AttributeType.TEXT,
      isRequired: false,
      order: 0,
      ...entityBase,
    });
    await database.db.insert(schema.attributeValues).values({
      id: 'sage-title',
      storyId: TEST_STORY_ID,
      entityType: 'Character',
      entityId: 'sage',
      fieldId: 'title-field',
      value: 'Keeper of the Harbor',
      ...entityBase,
    });

    const matches = await createGlobalSearchService(database.db).searchAllEntities(
      TEST_STORY_ID,
      'harbor',
      TEST_USER_ID,
    );

    const sage = matches.filter((match) => match.id === 'sage');
    expect(sage).toHaveLength(1);
    expect(sage[0]?.snippet).toContain('name: Harbor Sage');
  });

  it('searches entity attributes by the referenced title, never by the stored id', async () => {
    await database.db.insert(schema.characters).values({
      id: 'sage',
      storyId: TEST_STORY_ID,
      name: 'Sage',
      ...entityBase,
    });
    await database.db.insert(schema.locations).values({
      id: 'harbor',
      storyId: TEST_STORY_ID,
      name: 'Old Harbor',
      ...entityBase,
    });
    await database.db.insert(schema.storySchemaFields).values({
      id: 'home-field',
      storyId: TEST_STORY_ID,
      entityType: 'Character',
      name: 'Homeland',
      key: 'homeland',
      type: AttributeType.ENTITY,
      targetEntityType: 'Location',
      isRequired: false,
      order: 0,
      ...entityBase,
    });
    await database.db.insert(schema.attributeValues).values({
      id: 'sage-home',
      storyId: TEST_STORY_ID,
      entityType: 'Character',
      entityId: 'sage',
      fieldId: 'home-field',
      value: 'harbor',
      ...entityBase,
    });

    const matches = await createGlobalSearchService(database.db).searchAllEntities(
      TEST_STORY_ID,
      'harbor',
      TEST_USER_ID,
    );

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: 'Character',
          id: 'sage',
          title: 'Sage',
          snippet: expect.stringContaining('Homeland: Old Harbor'),
        }),
      ]),
    );
    // The raw ULID in the value column is not searchable text.
    expect(
      await createGlobalSearchService(database.db).searchAllEntities(
        TEST_STORY_ID,
        'sage-home',
        TEST_USER_ID,
      ),
    ).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'sage' })]));
  });

  it('pins every scene result to its chapter position', async () => {
    // Numbers derive from the chapters' order: a chapter before it makes it the second.
    await database.db.insert(schema.chapters).values({
      id: 'chapter-0',
      storyId: TEST_STORY_ID,
      name: 'The Departure',
      index: 1,
      ...entityBase,
    });
    await database.db.insert(schema.chapters).values({
      id: 'chapter-1',
      storyId: TEST_STORY_ID,
      name: 'The Crossing',
      index: 2,
      ...entityBase,
    });
    await database.db.insert(schema.scenes).values({
      id: 'scene-1',
      storyId: TEST_STORY_ID,
      chapterId: 'chapter-1',
      name: 'Harbor arrival',
      index: 1,
      ...entityBase,
    });

    const matches = await createGlobalSearchService(database.db).searchAllEntities(
      TEST_STORY_ID,
      'harbor',
      TEST_USER_ID,
    );

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: 'Scene',
          id: 'scene-1',
          context: '2. The Crossing',
        }),
      ]),
    );
  });

  it('carries the first field match for detail screens to land on', async () => {
    await database.db.insert(schema.characters).values([
      { id: 'sage', storyId: TEST_STORY_ID, name: 'Sage', ...entityBase },
      { id: 'captain', storyId: TEST_STORY_ID, name: 'Harbor Captain', ...entityBase },
    ]);
    await database.db
      .update(schema.characters)
      .set({ description: 'Keeper of the old harbor light.' })
      .where(eq(schema.characters.id, 'sage'));

    const matches = await createGlobalSearchService(database.db).searchAllEntities(
      TEST_STORY_ID,
      'harbor',
      TEST_USER_ID,
    );

    expect(matches.find((match) => match.id === 'sage')?.occurrence).toEqual({
      field: 'description',
      needle: 'harbor',
    });
    // Title matches land on top (the header): no occurrence rides along.
    expect(matches.find((match) => match.id === 'captain')?.occurrence).toBeUndefined();
  });

  it('frames the snippet around the match instead of truncating the head', async () => {
    await database.db.insert(schema.characters).values({
      id: 'sage',
      storyId: TEST_STORY_ID,
      name: 'Sage',
      ...entityBase,
    });
    await database.db
      .update(schema.characters)
      .set({ description: `Head ${'filler '.repeat(40)}harbor ${'tail '.repeat(40)}` })
      .where(eq(schema.characters.id, 'sage'));

    const matches = await createGlobalSearchService(database.db).searchAllEntities(
      TEST_STORY_ID,
      'harbor',
      TEST_USER_ID,
    );
    const snippet = matches.find((match) => match.id === 'sage')?.snippet ?? '';

    expect(snippet.startsWith('description: …')).toBe(true);
    expect(snippet).toContain('harbor');
    expect(snippet).not.toContain('Head');
  });

  it('addresses custom attributes by their detail-screen field key', async () => {
    await database.db.insert(schema.characters).values({
      id: 'sage',
      storyId: TEST_STORY_ID,
      name: 'Sage',
      ...entityBase,
    });
    await database.db.insert(schema.storySchemaFields).values({
      id: 'title-field',
      storyId: TEST_STORY_ID,
      entityType: 'Character',
      name: 'Title',
      key: 'title',
      type: AttributeType.TEXT,
      isRequired: false,
      order: 0,
      ...entityBase,
    });
    await database.db.insert(schema.attributeValues).values({
      id: 'sage-title',
      storyId: TEST_STORY_ID,
      entityType: 'Character',
      entityId: 'sage',
      fieldId: 'title-field',
      value: 'Keeper of the Harbor',
      ...entityBase,
    });

    const matches = await createGlobalSearchService(database.db).searchAllEntities(
      TEST_STORY_ID,
      'harbor',
      TEST_USER_ID,
    );

    expect(matches.find((match) => match.id === 'sage')?.occurrence).toEqual({
      field: 'custom:title-field',
      needle: 'harbor',
    });
  });

  it('decorates favoritable matches and leaves the rest without a favorite state', async () => {
    await database.db.insert(schema.characters).values({
      id: 'sage',
      storyId: TEST_STORY_ID,
      name: 'Harbor Sage',
      isFavorite: false,
      ...entityBase,
    });
    // The seeded story uses individual favorites: the marker lives in the favorites table.
    await database.db.insert(schema.favorites).values({
      id: 'fav-sage',
      storyId: TEST_STORY_ID,
      entityId: 'sage',
      entityType: 'Character',
      userId: TEST_USER_ID,
      ...entityBase,
    });
    await database.db.insert(schema.modes).values({
      id: 'mode-1',
      storyId: TEST_STORY_ID,
      characterId: 'sage',
      name: 'Harbor watch',
      ...entityBase,
    });

    const matches = await createGlobalSearchService(database.db).searchAllEntities(
      TEST_STORY_ID,
      'harbor',
      TEST_USER_ID,
    );

    expect(
      matches.find((match) => match.entityType === 'Character' && match.id === 'sage')?.isFavorite,
    ).toBe(true);
    // A Mode has no screen of its own: the result carries the owning character's id.
    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityType: 'Mode', id: 'sage', isFavorite: null }),
      ]),
    );
  });
});

describe('global search names the work of each result', () => {
  const arcRow = (id: string, title: string, sortOrder: number) => ({
    id,
    storyId: TEST_STORY_ID,
    title,
    description: null,
    sortOrder,
    color: null,
    icon: null,
    themeOverride: null,
    medium: 'generic' as const,
    vocabulary: null,
    author: null,
    coverGalleryId: null,
    pageFormat: null,
    isDefault: sortOrder === 0,
    ...entityBase,
  });

  async function seedTwoWorks() {
    await database.db
      .insert(schema.storyArcs)
      .values([arcRow('arc-1', 'Book One', 0), arcRow('arc-2', 'Book Two', 1)]);
    await database.db.insert(schema.chapters).values([
      {
        id: 'ch-1',
        storyId: TEST_STORY_ID,
        name: 'Lighthouse',
        index: 1,
        arcId: 'arc-1',
        ...entityBase,
      },
      {
        id: 'ch-2',
        storyId: TEST_STORY_ID,
        name: 'Harbor Two',
        index: 2,
        arcId: 'arc-2',
        ...entityBase,
      },
    ]);
    await database.db.insert(schema.scenes).values({
      id: 'sc-1',
      storyId: TEST_STORY_ID,
      chapterId: 'ch-2',
      name: 'Harbor arrival',
      index: 1,
      ...entityBase,
    });
    await database.db.insert(schema.characters).values({
      id: 'harbormaster',
      storyId: TEST_STORY_ID,
      name: 'Harbormaster',
      ...entityBase,
    });
    await database.db.insert(schema.characterScenes).values({
      id: 'cs-1',
      storyId: TEST_STORY_ID,
      characterId: 'harbormaster',
      sceneId: 'sc-1',
      ...entityBase,
    });
  }

  const search = (term: string) =>
    createGlobalSearchService(database.db).searchAllEntities(TEST_STORY_ID, term, TEST_USER_ID);

  it('says which work a chapter, a scene and a character belong to when there are several', async () => {
    await seedTwoWorks();

    const matches = await search('harbor');

    const arcOf = (id: string) => matches.find((match) => match.id === id)?.arcTitle;
    expect(arcOf('ch-2')).toBe('Book Two');
    expect(arcOf('sc-1')).toBe('Book Two');
    expect(arcOf('harbormaster')).toBe('Book Two');
  });

  it('says nothing when the story has a single work', async () => {
    await seedTwoWorks();
    await database.db
      .update(schema.storyArcs)
      .set({ isDeleted: true })
      .where(eq(schema.storyArcs.id, 'arc-1'));

    const matches = await search('harbor');

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((match) => match.arcTitle === undefined)).toBe(true);
  });

  it('leaves out the label of a result that sits in no work', async () => {
    await seedTwoWorks();
    await database.db.insert(schema.characters).values({
      id: 'lonely',
      storyId: TEST_STORY_ID,
      name: 'Harbor Ghost',
      ...entityBase,
    });

    const matches = await search('harbor ghost');

    expect(matches.find((match) => match.id === 'lonely')?.arcTitle).toBeUndefined();
  });
});
