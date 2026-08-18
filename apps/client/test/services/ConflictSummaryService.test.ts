/**
 * @jest-environment node
 */
import type { TFunction } from 'i18next';
import {
  buildConflictSummaries,
  collectEntityRefs,
  RELATION_ENTITY_TYPES,
} from '../../src/services/ConflictSummaryService';
import type { PendingConflict } from '../../src/services/SyncConflictService';

const t = ((key: string) => key) as unknown as TFunction;

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const NOW = new Date('2026-08-10T12:00:00.000Z');

const conflict = (overrides: Partial<PendingConflict> = {}): PendingConflict => ({
  id: 'conflict-1',
  storyId: STORY_ID,
  entityType: 'Character',
  entityId: 'char-1',
  reason: 'version_conflict',
  localOperationType: 'update',
  localOperationIds: [],
  localValues: {},
  serverValues: {},
  clientVersion: 1,
  serverVersion: 2,
  message: null,
  detectedAt: NOW,
  contestedFields: [],
  isDeletedOnServer: false,
  isLocalDelete: false,
  ...overrides,
});

describe('RELATION_ENTITY_TYPES', () => {
  it('lists exactly the 8 relation/junction entity types', () => {
    expect([...RELATION_ENTITY_TYPES].sort()).toEqual(
      [
        'CharacterRelation',
        'CharacterScene',
        'GalleryRelation',
        'ItemJourney',
        'LocationRelation',
        'NoteRelation',
        'SeeAlsoRelation',
        'TagRelation',
      ].sort(),
    );
  });
});

describe('collectEntityRefs', () => {
  it('collects fixed-type references for a CharacterRelation conflict', () => {
    const refs = collectEntityRefs([
      conflict({
        entityType: 'CharacterRelation',
        localValues: { character1Id: 'char-a', character2Id: 'char-b', relationType: 'allies' },
      }),
    ]);

    expect(refs).toEqual(
      expect.arrayContaining([
        { entityType: 'Character', entityId: 'char-a' },
        { entityType: 'Character', entityId: 'char-b' },
      ]),
    );
  });

  it('collects a dynamic-type reference for a TagRelation conflict, using the sibling type field', () => {
    const refs = collectEntityRefs([
      conflict({
        entityType: 'TagRelation',
        localValues: { tagId: 'tag-1', relationId: 'char-1', relationType: 'Character' },
      }),
    ]);

    expect(refs).toEqual(
      expect.arrayContaining([
        { entityType: 'Tag', entityId: 'tag-1' },
        { entityType: 'Character', entityId: 'char-1' },
      ]),
    );
  });

  it('falls back to serverValues for fields the local operation did not touch', () => {
    const refs = collectEntityRefs([
      conflict({
        entityType: 'CharacterScene',
        reason: 'deleted_on_server',
        localValues: { isDeleted: true },
        serverValues: { characterId: 'char-1', sceneId: 'scene-1' },
      }),
    ]);

    expect(refs).toEqual(
      expect.arrayContaining([
        { entityType: 'Character', entityId: 'char-1' },
        { entityType: 'Scene', entityId: 'scene-1' },
      ]),
    );
  });

  it('ignores non-relation conflicts entirely', () => {
    const refs = collectEntityRefs([conflict({ entityType: 'Character' })]);
    expect(refs).toEqual([]);
  });
});

describe('buildConflictSummaries - relation conflicts', () => {
  it('never produces diff fields for a relation conflict, only a resolved one-line summary', () => {
    const names = new Map([
      ['Character:char-a', 'Ana'],
      ['Character:char-b', 'Bia'],
    ]);
    const [summary] = buildConflictSummaries(
      [
        conflict({
          entityType: 'CharacterRelation',
          localValues: { character1Id: 'char-a', character2Id: 'char-b', relationType: 'allies' },
        }),
      ],
      names,
      t,
    );

    expect(summary.kind).toBe('relation');
    expect(summary.canQuickResolve).toBe(true);
    expect(summary.diffFields).toEqual([]);
    expect(summary.detail).toBe('Ana - Bia (allies)');
  });

  it('resolves a polymorphic TagRelation through the tag and its target', () => {
    const names = new Map([
      ['Tag:tag-1', 'Mistério'],
      ['Character:char-1', 'Mira'],
    ]);
    const [summary] = buildConflictSummaries(
      [
        conflict({
          entityType: 'TagRelation',
          localValues: { tagId: 'tag-1', relationId: 'char-1', relationType: 'Character' },
        }),
      ],
      names,
      t,
    );

    expect(summary.detail).toBe('Mistério - Mira');
  });

  it('falls back to a generic label when a referenced entity was not resolved', () => {
    const [summary] = buildConflictSummaries(
      [
        conflict({
          entityType: 'CharacterScene',
          localValues: { characterId: 'char-1', sceneId: 'scene-1' },
        }),
      ],
      new Map(),
      t,
    );

    expect(summary.detail).toBe('unknown_entity - unknown_entity');
  });
});

describe('buildConflictSummaries - content conflicts', () => {
  it('requires a diff drill-in when multiple real fields disagree', () => {
    const [summary] = buildConflictSummaries(
      [
        conflict({
          entityType: 'Character',
          localValues: { name: 'Aria', motivation: 'Vingança' },
          serverValues: { name: 'Aria', motivation: 'Redenção', title: 'A Lâmina' },
          contestedFields: ['motivation'],
        }),
      ],
      new Map(),
      t,
    );

    expect(summary.kind).toBe('content');
    expect(summary.canQuickResolve).toBe(false);
    expect(summary.diffFields).toEqual([
      {
        field: 'motivation',
        label: 'motivation',
        localDisplay: 'Vingança',
        serverDisplay: 'Redenção',
      },
    ]);
  });

  it('is quick-resolvable when the server deleted the entity, regardless of contested fields', () => {
    const [summary] = buildConflictSummaries(
      [
        conflict({
          entityType: 'Character',
          reason: 'deleted_on_server',
          localValues: { title: 'Novo Título' },
          serverValues: { isDeleted: true },
          contestedFields: [],
          isDeletedOnServer: true,
        }),
      ],
      new Map(),
      t,
    );

    expect(summary.canQuickResolve).toBe(true);
    expect(summary.diffFields).toEqual([]);
  });

  it('is quick-resolvable when there are no genuinely contested fields', () => {
    const [summary] = buildConflictSummaries(
      [conflict({ entityType: 'Character', contestedFields: [] })],
      new Map(),
      t,
    );

    expect(summary.canQuickResolve).toBe(true);
  });
});
