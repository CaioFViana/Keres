import { describe, expect, it } from 'vitest';
import {
  ChapterReorderingStoryUpdateSchema,
  CreateStoryUpdateSchema,
  DeleteStoryUpdateSchema,
  StoryUpdateSchema,
  StoryUpdatesArraySchema,
  SyncConflictSchema,
  SyncPushResultSchema,
  UlidSchema,
  UpdateStoryUpdateSchema,
} from '../../schemas/SyncSchemas';

const ulid = (suffix: string) => suffix.toUpperCase().padStart(26, '0');

const STORY_ID = ulid('story1');
const CHAPTER_ID = ulid('chapter1');

describe('UlidSchema', () => {
  it('accepts canonical 26-character Crockford ULIDs', () => {
    expect(UlidSchema.parse('01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAV');
  });

  it.each([
    ['too short', '01ARZ3NDEKTSV4RRFFQ69G5FA'],
    ['too long', '01ARZ3NDEKTSV4RRFFQ69G5FAVX'],
    ['lowercase', '01arz3ndektsv4rrffq69g5fav'],
    ['non-alphanumeric', '01ARZ3NDEKTSV4RRFFQ69G5F-V'],
    ['empty', ''],
  ])('rejects a %s value', (_label, value) => {
    expect(UlidSchema.safeParse(value).success).toBe(false);
  });
});

describe('StoryUpdateSchema', () => {
  it('parses a create operation carrying the full entity payload', () => {
    const update = {
      type: 'create' as const,
      entity: 'Character',
      id: STORY_ID,
      data: { name: 'Keres' },
      clientOperationId: 'local-1',
    };

    expect(StoryUpdateSchema.parse(update)).toMatchObject(update);
  });

  it('requires an id on update and delete operations', () => {
    expect(
      UpdateStoryUpdateSchema.safeParse({ type: 'update', entity: 'Character', changes: {} })
        .success,
    ).toBe(false);
    expect(DeleteStoryUpdateSchema.safeParse({ type: 'delete', entity: 'Character' }).success).toBe(
      false,
    );
    expect(
      DeleteStoryUpdateSchema.safeParse({
        type: 'delete',
        entity: 'Story',
        id: STORY_ID,
      }).success,
    ).toBe(true);
  });

  it('requires an id on create operations, since the client always generates the ULID', () => {
    expect(
      CreateStoryUpdateSchema.safeParse({ type: 'create', entity: 'Character', data: {} }).success,
    ).toBe(false);
    expect(
      CreateStoryUpdateSchema.safeParse({
        type: 'create',
        entity: 'Character',
        id: STORY_ID,
        data: {},
      }).success,
    ).toBe(true);
  });

  it('rejects an empty entity name', () => {
    expect(
      CreateStoryUpdateSchema.safeParse({ type: 'create', entity: '', data: {} }).success,
    ).toBe(false);
  });

  it('requires the OCC base version inside changes, not only on the envelope', () => {
    expect(
      UpdateStoryUpdateSchema.safeParse({
        type: 'update',
        entity: 'Chapter',
        id: CHAPTER_ID,
        changes: { name: 'Novo nome' },
      }).success,
    ).toBe(false);
  });

  it('keeps entity version and operation version as independent counters', () => {
    const parsed = UpdateStoryUpdateSchema.parse({
      type: 'update',
      entity: 'Chapter',
      id: CHAPTER_ID,
      changes: { name: 'Novo nome', version: 3 },
      version: 3,
      operationVersion: 87,
    });

    expect(parsed.version).toBe(3);
    expect(parsed.operationVersion).toBe(87);
  });

  it('rejects negative versions', () => {
    const base = {
      type: 'update' as const,
      entity: 'Chapter',
      id: CHAPTER_ID,
      changes: { version: 1 },
    };
    expect(UpdateStoryUpdateSchema.safeParse({ ...base, version: -1 }).success).toBe(false);
    expect(UpdateStoryUpdateSchema.safeParse({ ...base, operationVersion: -1 }).success).toBe(
      false,
    );
  });

  it('pins a chapter reorder to the Chapter entity and 1-based indices', () => {
    const reorder = {
      type: 'reorder' as const,
      entity: 'Chapter' as const,
      id: CHAPTER_ID,
      reorderItems: [{ id: ulid('scene1'), newIndex: 1 }],
    };

    expect(ChapterReorderingStoryUpdateSchema.parse(reorder)).toMatchObject(reorder);
    expect(
      ChapterReorderingStoryUpdateSchema.safeParse({
        ...reorder,
        reorderItems: [{ id: ulid('scene1'), newIndex: 0 }],
      }).success,
    ).toBe(false);
    expect(
      ChapterReorderingStoryUpdateSchema.safeParse({ ...reorder, entity: 'Scene' }).success,
    ).toBe(false);
  });

  it('rejects an operation type outside the union', () => {
    expect(
      StoryUpdateSchema.safeParse({ type: 'upsert', entity: 'Character', data: {} }).success,
    ).toBe(false);
  });

  it('validates every element of a push batch', () => {
    const batch = [
      { type: 'create', entity: 'Character', data: {} },
      { type: 'delete', entity: 'Character', id: STORY_ID },
    ];

    expect(StoryUpdatesArraySchema.safeParse(batch).success).toBe(false);
  });

  it('requires operationTime to be an ISO datetime string', () => {
    const base = { type: 'create' as const, entity: 'Character', id: STORY_ID, data: {} };
    expect(
      CreateStoryUpdateSchema.safeParse({ ...base, operationTime: '2026-08-11T18:00:00.000Z' })
        .success,
    ).toBe(true);
    expect(
      CreateStoryUpdateSchema.safeParse({ ...base, operationTime: '11/08/2026' }).success,
    ).toBe(false);
  });
});

describe('SyncPushResultSchema', () => {
  it('parses a mixed result with applied operations and conflicts', () => {
    const result = {
      message: 'ok',
      processedUpdates: 2,
      serverMaxOperationVersion: 42,
      applied: [
        { operationVersion: 41, entity: 'Character', entityId: STORY_ID, entityVersion: 2 },
      ],
      conflicts: [
        {
          entity: 'Chapter',
          entityId: CHAPTER_ID,
          type: 'update',
          reason: 'version_conflict',
          message: 'stale base version',
          clientVersion: 1,
          serverVersion: 4,
          serverEntity: { name: 'Servidor' },
        },
      ],
    };

    expect(SyncPushResultSchema.parse(result)).toEqual(result);
  });

  it('rejects a conflict reason the conflict screen would not know how to render', () => {
    const conflict = {
      entity: 'Chapter',
      entityId: CHAPTER_ID,
      type: 'update',
      reason: 'because_i_said_so',
      message: 'nope',
    };

    expect(SyncConflictSchema.safeParse(conflict).success).toBe(false);
  });

  it('accepts a null serverEntity for entities deleted on the server', () => {
    const conflict = {
      entity: 'Chapter',
      entityId: CHAPTER_ID,
      type: 'update' as const,
      reason: 'deleted_on_server' as const,
      message: 'gone',
      serverEntity: null,
    };

    expect(SyncConflictSchema.parse(conflict).serverEntity).toBeNull();
  });
});
