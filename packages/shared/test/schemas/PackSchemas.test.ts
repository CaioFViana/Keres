import { describe, expect, it } from 'vitest';
import { AttributeType } from '../../metadata/AttributeType';
import { summarizePackContent, validatePackContent } from '../../schemas/PackSchemas';

const now = new Date('2026-01-01T00:00:00.000Z');
const row = {
  storyId: 'story-1',
  createdAt: now,
  updatedAt: now,
  version: 1,
  isDeleted: false,
  deletedAt: null,
};
// Character ids are ULIDs; the rest of the row schemas accept opaque strings.
const characterRow = (id: string) => ({
  ...row,
  id,
  storyId: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
  name: 'Aria',
});

const field = {
  ...row,
  id: 'field-1',
  entityType: 'Character' as const,
  name: 'Origin',
  key: 'origin',
  description: null,
  type: AttributeType.SUGGESTION,
  targetEntityType: null,
  isRequired: false,
  defaultValue: null,
  order: 0,
};

const suggestion = { ...row, id: 'suggestion-1', type: 'custom:field-1', value: 'Forest' };
const stat = { ...row, id: 'stat-1', name: 'Courage', isPrimary: true, order: 0 };
const tier = { ...row, id: 'tier-1', statId: 'stat-1', label: 'Brave', minValue: 10 };

describe('validatePackContent', () => {
  it('accepts references owned by the same pack', () => {
    expect(
      validatePackContent({
        storySchemaFields: [field],
        suggestions: [suggestion],
        stats: [stat],
        statStrengths: [tier],
      }),
    ).toMatchObject({
      storySchemaFields: [expect.objectContaining({ id: 'field-1' })],
      suggestions: [expect.objectContaining({ type: 'custom:field-1' })],
      statStrengths: [expect.objectContaining({ statId: 'stat-1' })],
    });
  });

  it('rejects a custom suggestion whose field is absent', () => {
    expect(() => validatePackContent({ suggestions: [suggestion] })).toThrow(
      'custom suggestion must refer to a field',
    );
  });

  it('rejects a stat tier whose stat is absent', () => {
    expect(() => validatePackContent({ statStrengths: [tier] })).toThrow(
      'stat tier must refer to a stat',
    );
  });

  it('accepts extras whose joins all resolve inside the pack', () => {
    const chapter = {
      ...row,
      id: 'ch-1',
      name: 'Setup',
      index: 1,
      summary: null,
      isFavorite: false,
      extraNotes: null,
    };
    const scene = {
      ...row,
      id: 'scene-1',
      chapterId: 'ch-1',
      locationId: 'loc-1',
      name: 'Arrival',
      index: 0,
      summary: null,
      gap: null,
      gapType: null,
      calendarDateOverride: null,
      duration: null,
      durationType: null,
      isFinish: false,
      isStart: true,
      isFavorite: false,
      extraNotes: null,
    };
    const character = characterRow('01ARZ3NDEKTSV4RRFFQ69G5FB1');
    const location = {
      ...row,
      id: 'loc-1',
      name: 'Keep',
      description: null,
      climate: null,
      culture: null,
      politics: null,
      isFavorite: false,
      extraNotes: null,
    };
    const note = {
      ...row,
      id: 'note-1',
      title: 'Hook',
      body: null,
      isFavorite: false,
      extraNotes: null,
    };
    const tag = {
      ...row,
      id: 'tag-1',
      name: 'seed',
      color: null,
      isFavorite: false,
      extraNotes: null,
    };

    expect(
      validatePackContent({
        tags: [tag],
        extras: {
          chapters: [chapter],
          scenes: [scene],
          characters: [character],
          locations: [location],
          notes: [note],
          characterScenes: [{ ...row, id: 'cs-1', characterId: character.id, sceneId: 'scene-1' }],
          characterRelations: [
            {
              ...row,
              id: 'cr-1',
              character1Id: character.id,
              character2Id: character.id,
              relationType: 'self',
            },
          ],
          locationRelations: [
            {
              ...row,
              id: 'lr-1',
              locationAId: 'loc-1',
              locationBId: 'loc-1',
              relationType: 'contains',
            },
          ],
          noteRelations: [
            {
              ...row,
              id: 'nr-1',
              noteId: 'note-1',
              relationId: character.id,
              relationType: 'Character',
            },
          ],
          tagRelations: [
            {
              ...row,
              id: 'tr-1',
              tagId: 'tag-1',
              relationId: 'scene-1',
              relationType: 'Scene',
            },
          ],
        },
      }),
    ).toMatchObject({
      extras: {
        scenes: [expect.objectContaining({ id: 'scene-1' })],
        characters: [expect.objectContaining({ id: character.id })],
      },
    });
  });

  it('rejects extras with dangling references', () => {
    const scene = {
      ...row,
      id: 'scene-1',
      chapterId: 'missing-chapter',
      locationId: null,
      name: 'Arrival',
      index: 0,
      summary: null,
      gap: null,
      gapType: null,
      calendarDateOverride: null,
      duration: null,
      durationType: null,
      isFinish: false,
      isStart: true,
      isFavorite: false,
      extraNotes: null,
    };

    expect(() => validatePackContent({ extras: { scenes: [scene] } })).toThrow(
      'must belong to a chapter carried by this pack',
    );
    // An unfiled scene is not dangling: it travels as unfiled, exactly as story export
    // carries it.
    expect(() =>
      validatePackContent({ extras: { scenes: [{ ...scene, chapterId: null }] } }),
    ).not.toThrow();
    expect(() =>
      validatePackContent({
        extras: {
          characterRelations: [
            {
              ...row,
              id: 'cr-1',
              character1Id: 'ghost-1',
              character2Id: 'ghost-2',
              relationType: 'siblings',
            },
          ],
        },
      }),
    ).toThrow('must join characters carried by this pack');
    expect(() =>
      validatePackContent({
        extras: {
          chapters: [
            {
              ...row,
              id: 'ch-1',
              name: 'Setup',
              index: 1,
              summary: null,
              isFavorite: false,
              extraNotes: null,
              arcId: 'arc-1',
            },
          ],
        },
      }),
    ).toThrow('must not belong to an arc');
  });

  it('rejects joins pointing at element types packs do not carry', () => {
    const note = {
      ...row,
      id: 'note-1',
      title: 'Hook',
      body: null,
      isFavorite: false,
      extraNotes: null,
    };

    expect(() =>
      validatePackContent({
        extras: {
          notes: [note],
          noteRelations: [
            {
              ...row,
              id: 'nr-1',
              noteId: 'note-1',
              relationId: 'choice-1',
              relationType: 'Choice',
            },
          ],
        },
      }),
    ).toThrow('must join a carried note to a carried element');
  });

  it('migrates a v1 payload and refuses a future one', () => {
    expect(validatePackContent({ formatVersion: 1, tags: [] })).toMatchObject({
      formatVersion: 2,
      extras: expect.objectContaining({ chapters: [], tagRelations: [] }),
    });
    expect(() => validatePackContent({ formatVersion: 999 })).toThrow('newer version of Keres');
  });
});

describe('summarizePackContent', () => {
  it('counts schema and extras collections, tolerating v1 rows without extras', () => {
    const content = validatePackContent({
      tags: [
        {
          ...row,
          id: 'tag-1',
          name: 'seed',
          color: null,
          isFavorite: false,
          extraNotes: null,
        },
      ],
      extras: {
        scenes: [
          {
            ...row,
            id: 'scene-1',
            chapterId: null,
            locationId: null,
            name: 'Arrival',
            index: 0,
            summary: null,
            gap: null,
            gapType: null,
            calendarDateOverride: null,
            duration: null,
            durationType: null,
            isFinish: false,
            isStart: true,
            isFavorite: false,
            extraNotes: null,
          },
        ],
      },
    });

    expect(summarizePackContent(content)).toMatchObject({
      tagCount: 1,
      sceneCount: 1,
      chapterCount: 0,
    });
    expect(summarizePackContent({ ...content, extras: undefined as never })).toMatchObject({
      sceneCount: 0,
      chapterCount: 0,
    });
  });
});
