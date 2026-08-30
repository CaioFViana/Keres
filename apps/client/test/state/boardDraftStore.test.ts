/**
 * @jest-environment node
 */
import { useBoardDraftStore } from '../../src/state/boardDraftStore';

const empty = { nodes: [], edges: [] };
const dirty = {
  nodes: [
    {
      id: '01ABCDEF',
      kind: 'note' as const,
      x: 10,
      y: 10,
      title: 'Wick',
      body: null,
    },
  ],
  edges: [],
};

beforeEach(() => {
  useBoardDraftStore.getState().reset();
});

it('keeps the unsaved drawing for the same board', () => {
  useBoardDraftStore.getState().remember({
    boardId: 'board-1',
    storyId: 'story-1',
    content: dirty,
    savedContent: empty,
  });

  expect(useBoardDraftStore.getState().draft?.boardId).toBe('board-1');
  expect(useBoardDraftStore.getState().draft?.content.nodes).toHaveLength(1);
});

it('drops the drawing on reset', () => {
  useBoardDraftStore.getState().remember({
    boardId: 'board-1',
    storyId: 'story-1',
    content: dirty,
    savedContent: empty,
  });
  useBoardDraftStore.getState().reset();

  expect(useBoardDraftStore.getState().draft).toBeNull();
});
