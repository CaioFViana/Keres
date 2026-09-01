/**
 * @jest-environment node
 */
import type { TFunction } from 'i18next';
import {
  buildConflictSummaries,
  collectConflictEntityRefs,
  collectEntityRefs,
  RELATION_ENTITY_TYPES,
} from '../../src/services/ConflictSummaryService';
import type { PendingConflict } from '../../src/services/SyncConflictService';

const t = ((key: string) => key) as unknown as TFunction;

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const NOW = new Date('2026-08-10T12:00:00.000Z');
const noSnapshots = new Map<string, Record<string, any>>();

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
  it('lists exactly the 9 relation/junction entity types', () => {
    expect([...RELATION_ENTITY_TYPES].sort()).toEqual(
      [
        'CharacterRelation',
        'CharacterScene',
        'GalleryRelation',
        'ItemJourney',
        'LocationRelation',
        'NoteRelation',
        'SeeAlsoRelation',
        'StatRelation',
        'TagRelation',
      ].sort(),
    );
  });
});

describe('collectConflictEntityRefs', () => {
  it('returns one reference per conflict, for its own entity', () => {
    const refs = collectConflictEntityRefs([
      conflict({ entityType: 'Character', entityId: 'char-1' }),
      conflict({ entityType: 'CharacterRelation', entityId: 'relation-1' }),
    ]);

    expect(refs).toEqual([
      { entityType: 'Character', entityId: 'char-1' },
      { entityType: 'CharacterRelation', entityId: 'relation-1' },
    ]);
  });
});

describe('collectEntityRefs', () => {
  it('collects fixed-type references for a CharacterRelation conflict', () => {
    const refs = collectEntityRefs(
      [
        conflict({
          entityType: 'CharacterRelation',
          localValues: { character1Id: 'char-a', character2Id: 'char-b', relationType: 'allies' },
        }),
      ],
      noSnapshots,
    );

    expect(refs).toEqual(
      expect.arrayContaining([
        { entityType: 'Character', entityId: 'char-a' },
        { entityType: 'Character', entityId: 'char-b' },
      ]),
    );
  });

  it('collects a dynamic-type reference for a TagRelation conflict, using the sibling type field', () => {
    const refs = collectEntityRefs(
      [
        conflict({
          entityType: 'TagRelation',
          localValues: { tagId: 'tag-1', relationId: 'char-1', relationType: 'Character' },
        }),
      ],
      noSnapshots,
    );

    expect(refs).toEqual(
      expect.arrayContaining([
        { entityType: 'Tag', entityId: 'tag-1' },
        { entityType: 'Character', entityId: 'char-1' },
      ]),
    );
  });

  it('falls back to serverValues for fields the local operation did not touch', () => {
    const refs = collectEntityRefs(
      [
        conflict({
          entityType: 'CharacterScene',
          reason: 'deleted_on_server',
          localValues: { isDeleted: true },
          serverValues: { characterId: 'char-1', sceneId: 'scene-1' },
        }),
      ],
      noSnapshots,
    );

    expect(refs).toEqual(
      expect.arrayContaining([
        { entityType: 'Character', entityId: 'char-1' },
        { entityType: 'Scene', entityId: 'scene-1' },
      ]),
    );
  });

  it('ignores non-relation conflicts entirely', () => {
    const refs = collectEntityRefs([conflict({ entityType: 'Character' })], noSnapshots);
    expect(refs).toEqual([]);
  });

  /**
   * Regression: a `deleted_on_server` conflict does not carry `character1Id`/`character2Id` on
   * either side (`serverValues` is only `{isDeleted, version}`, on purpose) - without the
   * local row's snapshot, `collectEntityRefs` would have no way of knowing which characters to
   * resolve, and the screen fell into "unknown_entity" even with the local row still existing.
   */
  it('finds relation target fields only present in the snapshot of the local row', () => {
    const snapshots = new Map([
      ['CharacterRelation:relation-1', { character1Id: 'char-a', character2Id: 'char-b' }],
    ]);
    const refs = collectEntityRefs(
      [
        conflict({
          entityType: 'CharacterRelation',
          entityId: 'relation-1',
          reason: 'deleted_on_server',
          localValues: { relationType: 'rivals' },
          serverValues: { isDeleted: true },
        }),
      ],
      snapshots,
    );

    expect(refs).toEqual(
      expect.arrayContaining([
        { entityType: 'Character', entityId: 'char-a' },
        { entityType: 'Character', entityId: 'char-b' },
      ]),
    );
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
      noSnapshots,
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
      noSnapshots,
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
      noSnapshots,
      new Map(),
      t,
    );

    expect(summary.detail).toBe('unknown_entity - unknown_entity');
  });

  it.each([
    [
      'NoteRelation',
      { noteId: 'note-1', relationId: 'rule-1', relationType: 'WorldRule' },
      [
        ['Note:note-1', 'Rascunho'],
        ['WorldRule:rule-1', 'Magia cobra preço'],
      ],
      'Rascunho - Magia cobra preço',
    ],
    [
      'LocationRelation',
      { locationAId: 'location-a', locationBId: 'location-b', relationType: 'contains' },
      [
        ['Location:location-a', 'Cidade'],
        ['Location:location-b', 'Torre'],
      ],
      'location_contains_location',
    ],
    [
      'GalleryRelation',
      { galleryId: 'gallery-1', ownerId: 'character-1', ownerType: 'Character' },
      [
        ['Gallery:gallery-1', 'Mapa'],
        ['Character:character-1', 'Ari'],
      ],
      'Mapa - Ari',
    ],
    [
      'ItemJourney',
      { itemId: 'item-1', sceneId: 'scene-1', newCharacterOwnerId: null },
      [
        ['Item:item-1', 'Chave'],
        ['Scene:scene-1', 'Chegada'],
      ],
      'Chave showed_in_scene Chegada',
    ],
    [
      'SeeAlsoRelation',
      { entityAId: 'character-1', entityAType: 'Character', entityBId: 'item-1', entityBType: 'Item' },
      [
        ['Character:character-1', 'Ari'],
        ['Item:item-1', 'Chave'],
      ],
      'Ari - Chave',
    ],
  ] as const)(
    'summarizes every remaining %s relation without exposing identifiers',
    (entityType, localValues, entries, expectedDetail) => {
      const [summary] = buildConflictSummaries(
        [conflict({ entityType, localValues })],
        noSnapshots,
        new Map(entries),
        t,
      );

      expect(summary.kind).toBe('relation');
      expect(summary.detail).toBe(expectedDetail);
      expect(summary.detail).not.toContain('-1');
    },
  );

  /**
   * Regression: character A deleted on device 1, the relation edited (only `relationType`) on
   * device 2 offline. `localValues`/`serverValues` do not have `character1Id`/`character2Id`
   * - only the local row's snapshot (resolved by `EntitySnapshotResolver`) knows who the
   * two characters are.
   */
  it('resolves relation participants from the local snapshot when deleted_on_server leaves both sides sparse', () => {
    const snapshots = new Map([
      ['CharacterRelation:relation-1', { character1Id: 'char-a', character2Id: 'char-b' }],
    ]);
    const names = new Map([
      ['Character:char-a', 'Ana'],
      ['Character:char-b', 'Bia'],
    ]);
    const [summary] = buildConflictSummaries(
      [
        conflict({
          entityType: 'CharacterRelation',
          entityId: 'relation-1',
          reason: 'deleted_on_server',
          localValues: { relationType: 'rivals' },
          serverValues: { isDeleted: true },
        }),
      ],
      snapshots,
      names,
      t,
    );

    expect(summary.detail).toBe('Ana - Bia (rivals)');
  });
});

describe('collectEntityRefs - content conflicts with id-type fields', () => {
  it('collects a reference for an id-type field contested on a content (non-relation) entity', () => {
    const refs = collectEntityRefs(
      [
        conflict({
          entityType: 'Scene',
          localValues: { chapterId: 'chapter-1' },
          contestedFields: ['chapterId'],
        }),
      ],
      noSnapshots,
    );

    expect(refs).toEqual(
      expect.arrayContaining([{ entityType: 'Chapter', entityId: 'chapter-1' }]),
    );
  });

  it('ignores contested fields with no known entity target', () => {
    const refs = collectEntityRefs(
      [
        conflict({
          entityType: 'Character',
          localValues: { motivation: 'Vingança' },
          contestedFields: ['motivation'],
        }),
      ],
      noSnapshots,
    );

    expect(refs).toEqual([]);
  });
});

describe('buildConflictSummaries - entity display name fallbacks', () => {
  /**
   * Regression: `Choice` has neither `name` nor `title` - the identifying field is `text`. Without a
   * fallback for it, every Choice conflict showed the raw ULID as the entity's "name".
   */
  it('uses text as the display name for a Choice, which has neither name nor title', () => {
    const [summary] = buildConflictSummaries(
      [
        conflict({
          entityType: 'Choice',
          entityId: 'choice-1',
          localValues: { text: 'Seguir pela estrada' },
          contestedFields: [],
        }),
      ],
      noSnapshots,
      new Map(),
      t,
    );

    expect(summary.title).toBe('Seguir pela estrada');
    expect(summary.title).not.toBe('choice-1');
  });

  /** Regression: Gallery.title is optional - it falls back to the file name, never to the raw ID. */
  it('falls back to the file name for a Gallery with no title', () => {
    const [summary] = buildConflictSummaries(
      [
        conflict({
          entityType: 'Gallery',
          entityId: 'gallery-1',
          localValues: { fileName: 'mapa.png' },
          contestedFields: [],
        }),
      ],
      noSnapshots,
      new Map(),
      t,
    );

    expect(summary.title).toBe('mapa.png');
    expect(summary.title).not.toBe('gallery-1');
  });

  it('still falls back to the raw id when nothing identifying is available at all', () => {
    const [summary] = buildConflictSummaries(
      [conflict({ entityType: 'Chapter', entityId: 'chapter-1', contestedFields: [] })],
      noSnapshots,
      new Map(),
      t,
    );

    expect(summary.title).toBe('chapter-1');
  });

  /**
   * A real regression (a character deleted on device 1, a different attribute edited on
   * device 2): `deleted_on_server` leaves `serverValues` with only `{isDeleted, version}`, and
   * `localValues` has only the attribute the user changed (not `name`) - neither side
   * carries the name. The local row itself was not deleted (the remote deletion is deliberately not
   * applied), so the snapshot still has the real name.
   */
  it('uses the local snapshot name when deleted_on_server leaves both sides without one', () => {
    const snapshots = new Map([['Character:char-1', { name: 'Aria' }]]);
    const [summary] = buildConflictSummaries(
      [
        conflict({
          entityType: 'Character',
          entityId: 'char-1',
          reason: 'deleted_on_server',
          localValues: { motivation: 'Nova motivação' },
          serverValues: { isDeleted: true },
          isDeletedOnServer: true,
        }),
      ],
      snapshots,
      new Map(),
      t,
    );

    expect(summary.title).toBe('Aria');
    expect(summary.title).not.toBe('char-1');
  });

  it('offers a board clone instead of a field-by-field JSON diff when content clashes', () => {
    const [summary] = buildConflictSummaries(
      [
        conflict({
          entityType: 'Board',
          entityId: 'board-1',
          localValues: { name: 'Royal family', content: { nodes: [], edges: [] } },
          serverValues: {
            name: 'Royal family',
            content: { nodes: [{ id: '01ABCDEF' }], edges: [] },
          },
          contestedFields: ['content'],
        }),
      ],
      noSnapshots,
      new Map(),
      t,
    );

    expect(summary.offerBoardClone).toBe(true);
    expect(summary.canQuickResolve).toBe(true);
    expect(summary.diffFields).toEqual([]);
  });
});

describe('buildConflictSummaries - diff field labels and id resolution', () => {
  /**
   * Regression: `t(field, {defaultValue: field})` only worked by coincidence for the few
   * fields that also have a loose translation key without the `field_` prefix - `isFavorite` only
   * has `field_isFavorite`, so it appeared raw ("isFavorite") in the comparison.
   */
  it('resolves a field label through entityFieldMetadata instead of showing the raw key', () => {
    const [summary] = buildConflictSummaries(
      [
        conflict({
          entityType: 'Character',
          localValues: { isFavorite: true },
          serverValues: { isFavorite: false },
          contestedFields: ['isFavorite'],
        }),
      ],
      noSnapshots,
      new Map(),
      t,
    );

    expect(summary.diffFields[0].label).toBe('field_isFavorite');
  });

  /**
   * Regression: a content field that is another entity's ID (e.g. `Scene.chapterId`) showed
   * the raw ID in the field-by-field comparison - only the 8 relations had names resolved.
   */
  it('resolves an id-type content field to a name instead of showing the raw id', () => {
    const names = new Map([['Chapter:chapter-a', 'Capítulo 1']]);
    const [summary] = buildConflictSummaries(
      [
        conflict({
          entityType: 'Scene',
          localValues: { chapterId: 'chapter-a' },
          serverValues: { chapterId: 'chapter-b' },
          contestedFields: ['chapterId'],
        }),
      ],
      noSnapshots,
      names,
      t,
    );

    expect(summary.diffFields[0].localDisplay).toBe('Capítulo 1');
    expect(summary.diffFields[0].serverDisplay).toBe('chapter-b');
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
      noSnapshots,
      new Map(),
      t,
    );

    expect(summary.kind).toBe('content');
    expect(summary.canQuickResolve).toBe(false);
    expect(summary.diffFields).toEqual([
      {
        field: 'motivation',
        label: 'field_motivation',
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
      noSnapshots,
      new Map(),
      t,
    );

    expect(summary.canQuickResolve).toBe(true);
    expect(summary.diffFields).toEqual([]);
  });

  it('is quick-resolvable when there are no genuinely contested fields', () => {
    const [summary] = buildConflictSummaries(
      [conflict({ entityType: 'Character', contestedFields: [] })],
      noSnapshots,
      new Map(),
      t,
    );

    expect(summary.canQuickResolve).toBe(true);
  });
});

/**
 * The conflict the user actually saw: a stat value refused by the server, displayed
 * as "relations - Stat value" followed by a raw ULID and by a reason that explained nothing.
 */
describe('stat value conflicts', () => {
  const names = new Map<string, string>([
    ['Character:char-1', 'Ilda'],
    ['Stat:stat-1', 'Dexterity'],
    ['Mode:mode-1', 'Na tempestade'],
  ]);

  const statValueConflict = (overrides: Partial<PendingConflict> = {}) =>
    conflict({
      entityType: 'StatRelation',
      entityId: 'value-1',
      reason: 'validation',
      localOperationType: 'create',
      localValues: { characterId: 'char-1', modeId: null, statId: 'stat-1', value: 5 },
      serverValues: null,
      ...overrides,
    });

  it('names the character and the stat instead of showing a raw id', () => {
    const [summary] = buildConflictSummaries([statValueConflict()], noSnapshots, names, t);

    expect(summary!.title).toBe('stat_relation');
    expect(summary!.detail).toContain('Ilda - Dexterity: 5');
    expect(summary!.detail).not.toContain('value-1');
  });

  it('says which mode the value belongs to', () => {
    const [summary] = buildConflictSummaries(
      [
        statValueConflict({
          localValues: { characterId: 'char-1', modeId: 'mode-1', statId: 'stat-1', value: 9 },
        }),
      ],
      noSnapshots,
      names,
      t,
    );

    expect(summary!.detail).toContain('Ilda · Na tempestade - Dexterity: 9');
  });

  it('adds the reason the server gave, which is the only thing that explains a validation refusal', () => {
    const [summary] = buildConflictSummaries(
      [statValueConflict({ message: 'Validation Error: character already has a value.' })],
      noSnapshots,
      names,
      t,
    );

    expect(summary!.detail).toContain('character already has a value');
  });

  it('stays quiet about the server message when the reason already explains itself', () => {
    const [summary] = buildConflictSummaries(
      [statValueConflict({ reason: 'version_conflict', message: 'ruído interno' })],
      noSnapshots,
      names,
      t,
    );

    expect(summary!.detail).not.toContain('ruído interno');
  });

  it('collects the character, the stat and the mode as names to resolve', () => {
    const refs = collectEntityRefs(
      [
        statValueConflict({
          localValues: { characterId: 'char-1', modeId: 'mode-1', statId: 'stat-1', value: 9 },
        }),
      ],
      noSnapshots,
    );

    expect(refs).toEqual(
      expect.arrayContaining([
        { entityType: 'Character', entityId: 'char-1' },
        { entityType: 'Stat', entityId: 'stat-1' },
        { entityType: 'Mode', entityId: 'mode-1' },
      ]),
    );
  });
});
