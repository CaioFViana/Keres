import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStoryUpdate } from '@keres/shared';
import { db } from '../../src/db';
import { stories, users } from '../../src/db/schema';
import { BoardSyncHandler } from '../../src/services/entity-sync-handlers/BoardSyncHandler';
import { syncValuesMatch } from '../../src/services/entity-sync-handlers/syncValueComparison';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let userId: string;
let storyId: string;

beforeEach(async () => {
  await truncateAll();
  userId = newId();
  storyId = newId();
  const now = new Date();
  await db
    .insert(users)
    .values({ id: userId, username: 'ana', tag: 'ana', password: 'x' } as never);
  await db.insert(stories).values({
    id: storyId,
    userId,
    title: 'A Queda',
    type: 'linear',
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
  } as never);
});

describe('sync value comparison', () => {
  it('treats a resent board as identical regardless of JSON key order', async () => {
    const handler = new BoardSyncHandler();
    const id = newId();
    await handler.create(userId, storyId, {
      type: 'create',
      entity: 'Board',
      id,
      data: {
        name: 'Pins',
        description: null,
        content: {
          nodes: [
            { id: 'AAAAAAAA', kind: 'note', x: 10, y: 20, title: 'Pista', body: 'seguir' },
            {
              id: 'BBBBBBBB',
              kind: 'entity',
              x: 30,
              y: 40,
              entityType: 'Character',
              entityId: 'char-1',
              labelAtPin: 'Keres',
            },
          ],
          edges: [
            { id: 'CCCCCCCC', from: 'AAAAAAAA', to: 'BBBBBBBB', directed: true, label: null },
          ],
        },
      },
    } as CreateStoryUpdate);
    const row = await handler.findByIdOrThrow(id);

    // Same document, every object written with its keys in a different order.
    expect(
      handler.createPayloadMatches(row, {
        content: {
          edges: [
            { label: null, to: 'BBBBBBBB', from: 'AAAAAAAA', directed: true, id: 'CCCCCCCC' },
          ],
          nodes: [
            { body: 'seguir', title: 'Pista', y: 20, x: 10, kind: 'note', id: 'AAAAAAAA' },
            {
              labelAtPin: 'Keres',
              entityId: 'char-1',
              entityType: 'Character',
              y: 40,
              x: 30,
              kind: 'entity',
              id: 'BBBBBBBB',
            },
          ],
        },
        description: null,
        name: 'Pins',
      }),
    ).toBe(true);
  });

  it('spots any difference inside a resent board document', async () => {
    const handler = new BoardSyncHandler();
    const id = newId();
    const content = {
      nodes: [{ id: 'AAAAAAAA', kind: 'note', x: 10, y: 20, title: 'Pista', body: 'seguir' }],
      edges: [],
    };
    await handler.create(userId, storyId, {
      type: 'create',
      entity: 'Board',
      id,
      data: { name: 'Pins', description: null, content },
    } as CreateStoryUpdate);
    const row = await handler.findByIdOrThrow(id);

    expect(handler.createPayloadMatches(row, { name: 'Pins', content })).toBe(true);
    expect(
      handler.createPayloadMatches(row, {
        name: 'Pins',
        content: {
          nodes: [{ id: 'AAAAAAAA', kind: 'note', x: 10, y: 20, title: 'Outra', body: 'seguir' }],
          edges: [],
        },
      }),
    ).toBe(false);
    // Same nodes, reordered: arrays are positional, so this is a different document.
    expect(
      handler.createPayloadMatches(row, {
        name: 'Pins',
        content: {
          nodes: [
            { id: 'BBBBBBBB', kind: 'note', x: 1, y: 1, title: 'Extra', body: null },
            { id: 'AAAAAAAA', kind: 'note', x: 10, y: 20, title: 'Pista', body: 'seguir' },
          ],
          edges: [],
        },
      }),
    ).toBe(false);
    // A longer edge list is a different document too.
    expect(
      handler.createPayloadMatches(row, {
        name: 'Pins',
        content: {
          nodes: content.nodes,
          edges: [
            { id: 'CCCCCCCC', from: 'AAAAAAAA', to: 'AAAAAAAA', directed: false, label: null },
          ],
        },
      }),
    ).toBe(false);
    // Not a board at all: the comparison refuses instead of throwing.
    expect(handler.createPayloadMatches(row, { name: 'Pins', content: 'nope' })).toBe(false);
  });

  it('compares dates by instant, not by representation', () => {
    expect(
      syncValuesMatch(new Date('2025-01-02T03:04:05.000Z'), new Date('2025-01-02T03:04:05.000Z')),
    ).toBe(true);
    expect(
      syncValuesMatch(new Date('2025-01-02T03:04:05.000Z'), new Date('2025-01-03T03:04:05.000Z')),
    ).toBe(false);
    expect(syncValuesMatch(new Date('2025-01-02T03:04:05.000Z'), '2025-01-02T03:04:05.000Z')).toBe(
      true,
    );
    expect(syncValuesMatch('2025-01-02T03:04:05.000Z', new Date('2025-01-02T03:04:05.000Z'))).toBe(
      true,
    );
    expect(syncValuesMatch(new Date('2025-01-02T03:04:05.000Z'), 'not a date')).toBe(false);
  });

  it('compares scalars, nullables, arrays and objects structurally', () => {
    expect(syncValuesMatch('a', 'a')).toBe(true);
    expect(syncValuesMatch('a', 'b')).toBe(false);
    expect(syncValuesMatch(1, 1)).toBe(true);
    expect(syncValuesMatch(null, undefined)).toBe(true);
    expect(syncValuesMatch(null, null)).toBe(true);
    expect(syncValuesMatch(0, null)).toBe(false);
    expect(syncValuesMatch([1, 2], [1, 2])).toBe(true);
    expect(syncValuesMatch([1, 2], [2, 1])).toBe(false);
    expect(syncValuesMatch([1], [1, 2])).toBe(false);
    expect(syncValuesMatch([1], 'x')).toBe(false);
    expect(syncValuesMatch('x', [1])).toBe(false);
    expect(syncValuesMatch({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(syncValuesMatch({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(syncValuesMatch({ a: 1 }, { a: 2 })).toBe(false);
    expect(syncValuesMatch({ a: { b: [1] } }, { a: { b: [1] } })).toBe(true);
    expect(syncValuesMatch({ a: { b: [1] } }, { a: { b: [2] } })).toBe(false);
  });
});
