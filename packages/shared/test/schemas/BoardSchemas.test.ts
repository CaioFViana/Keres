import { describe, expect, it } from 'vitest';
import {
  BoardContentSchema,
  CreateBoardDataSchema,
  generateBoardLocalId,
  remapBoardContent,
} from '../../schemas/BoardSchemas';

const nodeId = '01ABCDEF';
const otherId = '02GHJKMN';

describe('BoardContentSchema', () => {
  it('accepts an empty drawing', () => {
    expect(BoardContentSchema.parse({ nodes: [], edges: [] })).toEqual({ nodes: [], edges: [] });
  });

  it('defaults a new board to an empty drawing', () => {
    expect(CreateBoardDataSchema.parse({ name: 'Royal family' })).toMatchObject({
      name: 'Royal family',
      description: null,
      content: { nodes: [], edges: [] },
    });
  });

  it('allows two pins of the same entity', () => {
    const content = BoardContentSchema.parse({
      nodes: [
        {
          id: nodeId,
          kind: 'entity',
          x: 0,
          y: 0,
          entityType: 'Character',
          entityId: 'character-1',
          labelAtPin: 'Nyx',
        },
        {
          id: otherId,
          kind: 'entity',
          x: 40,
          y: 10,
          entityType: 'Character',
          entityId: 'character-1',
          labelAtPin: 'Nyx',
        },
      ],
      edges: [],
    });
    expect(content.nodes).toHaveLength(2);
    expect(content.nodes[0]).toMatchObject({ displayMode: 'compact', cardNote: null });
  });

  it('rejects an edge that points at a missing node', () => {
    expect(() =>
      BoardContentSchema.parse({
        nodes: [
          {
            id: nodeId,
            kind: 'note',
            x: 0,
            y: 0,
            title: 'Theme',
            body: null,
          },
        ],
        edges: [{ id: otherId, from: nodeId, to: 'ZZZZZZZZ', directed: false, label: null }],
      }),
    ).toThrow(/not on this board/);
  });

  it('allocates ids that do not collide with ones already on the board', () => {
    const existing = new Set([nodeId]);
    const next = generateBoardLocalId(existing);
    expect(next).toHaveLength(8);
    expect(existing.has(next)).toBe(false);
  });

  it('rewrites entity pins on clone and leaves note nodes and local ids alone', () => {
    const remapped = remapBoardContent(
      {
        nodes: [
          {
            id: nodeId,
            kind: 'entity',
            x: 1,
            y: 2,
            entityType: 'Scene',
            entityId: 'old-scene',
            labelAtPin: 'The dock',
            displayMode: 'summary-and-note',
            cardNote: 'Bring the storm motif forward.',
          },
          { id: otherId, kind: 'note', x: 3, y: 4, title: 'TODO', body: null },
        ],
        edges: [{ id: '03PQRSTV', from: nodeId, to: otherId, directed: true, label: 'leads to' }],
      },
      (id) => (id === 'old-scene' ? 'new-scene' : id),
    );
    expect(remapped.nodes[0]).toMatchObject({
      id: nodeId,
      entityId: 'new-scene',
      displayMode: 'summary-and-note',
      cardNote: 'Bring the storm motif forward.',
    });
    expect(remapped.nodes[1]).toMatchObject({ id: otherId, kind: 'note' });
    expect(remapped.edges[0].from).toBe(nodeId);
  });
});
