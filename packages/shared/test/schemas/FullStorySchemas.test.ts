import { describe, expect, it } from 'vitest';
import { FullStoryExportSchema } from '../../schemas/FullStorySchemas';
import { CURRENT_STORY_FORMAT_VERSION } from '../../schemas/StoryExportVersion';

const ulid = (suffix: string) => suffix.toUpperCase().padStart(26, '0');

const STORY_ID = ulid('story1');
const USER_ID = ulid('user1');

/** Coleções que todo export precisa trazer, mesmo vazias. */
const REQUIRED_COLLECTIONS = [
  'chapters',
  'scenes',
  'choices',
  'characters',
  'locations',
  'worldRules',
  'notes',
  'noteRelations',
  'tags',
  'tagRelations',
  'suggestions',
  'characterRelations',
  'characterScenes',
  'galleryItems',
  'itemJourneys',
] as const;

/**
 * Coleções adicionadas depois que o formato já existia. Precisam continuar opcionais: um
 * pacote antigo no disco do usuário tem de importar sem erro.
 */
const LEGACY_OPTIONAL_COLLECTIONS = [
  'galleryRelations',
  'items',
  'storySchemaFields',
  'attributeValues',
  'favorites',
  'comments',
  'seeAlsoRelations',
  'locationRelations',
] as const;

function buildExport(overrides: Record<string, unknown> = {}) {
  const collections = Object.fromEntries(REQUIRED_COLLECTIONS.map((name) => [name, []]));

  return {
    story: { id: STORY_ID, userId: USER_ID, title: 'A Queda', type: 'linear' },
    ...collections,
    serverLastOperationVersion: 0,
    formatVersion: CURRENT_STORY_FORMAT_VERSION,
    ...overrides,
  };
}

describe('FullStoryExportSchema', () => {
  it('parses an export whose collections are all empty', () => {
    const parsed = FullStoryExportSchema.parse(buildExport());

    expect(parsed.story.id).toBe(STORY_ID);
    expect(parsed.formatVersion).toBe(CURRENT_STORY_FORMAT_VERSION);
    expect(parsed.chapters).toEqual([]);
  });

  it.each(REQUIRED_COLLECTIONS)('rejects an export missing %s', (collection) => {
    const payload = buildExport();
    delete (payload as Record<string, unknown>)[collection];

    expect(FullStoryExportSchema.safeParse(payload).success).toBe(false);
  });

  it.each(LEGACY_OPTIONAL_COLLECTIONS)('imports a legacy export that predates %s', (collection) => {
    const payload = buildExport();
    expect(collection in payload).toBe(false);

    const parsed = FullStoryExportSchema.parse(payload);
    expect(parsed[collection]).toBeUndefined();
  });

  it('falls back to the current format version when the field is absent', () => {
    const payload = buildExport();
    delete (payload as Record<string, unknown>).formatVersion;

    expect(FullStoryExportSchema.parse(payload).formatVersion).toBe(CURRENT_STORY_FORMAT_VERSION);
  });

  it('validates the entities inside the collections, not just their shape', () => {
    const withBadChapter = buildExport({ chapters: [{ id: ulid('chapter1'), name: 'Sem storyId' }] });

    expect(FullStoryExportSchema.safeParse(withBadChapter).success).toBe(false);
  });

  it('coerces ISO date strings back into Date objects on import', () => {
    const parsed = FullStoryExportSchema.parse(
      buildExport({
        chapters: [
          {
            id: ulid('chapter1'),
            storyId: STORY_ID,
            name: 'Capítulo 1',
            index: 1,
            summary: null,
            isFavorite: false,
            extraNotes: null,
            createdAt: '2026-08-11T18:00:00.000Z',
            updatedAt: '2026-08-11T18:00:00.000Z',
            version: 1,
            isDeleted: false,
            deletedAt: null,
          },
        ],
      }),
    );

    expect(parsed.chapters[0].createdAt).toBeInstanceOf(Date);
    expect(parsed.chapters[0].createdAt.toISOString()).toBe('2026-08-11T18:00:00.000Z');
  });

  it('rejects a story id that is not a ULID', () => {
    const payload = buildExport({ story: { id: 'story-1', userId: USER_ID, title: 'A Queda', type: 'linear' } });

    expect(FullStoryExportSchema.safeParse(payload).success).toBe(false);
  });

  it('requires the server operation version so the imported story can resume syncing', () => {
    const payload = buildExport();
    delete (payload as Record<string, unknown>).serverLastOperationVersion;

    expect(FullStoryExportSchema.safeParse(payload).success).toBe(false);
    expect(FullStoryExportSchema.safeParse(buildExport({ serverLastOperationVersion: -1 })).success).toBe(false);
  });
});
