/**
 * @jest-environment node
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBoardDraftStore } from '../../src/state/boardDraftStore';
import { readCanvasDraft } from '../../src/services/canvasDraftPersistence';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

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

beforeEach(async () => {
  jest.useRealTimers();
  await AsyncStorage.clear();
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

it('hydrates a durable draft after memory was cleared', async () => {
  jest.useFakeTimers();
  useBoardDraftStore.getState().remember({
    boardId: 'board-1',
    storyId: 'story-1',
    content: dirty,
    savedContent: empty,
  });
  await jest.advanceTimersByTimeAsync(400);
  useBoardDraftStore.setState({ draft: null });

  const restored = await useBoardDraftStore.getState().hydrate('story-1', 'board-1');
  expect(restored?.content.nodes).toHaveLength(1);
  expect(useBoardDraftStore.getState().draft?.boardId).toBe('board-1');
});

it('does not keep a durable draft when content matches savedContent', async () => {
  jest.useFakeTimers();
  useBoardDraftStore.getState().remember({
    boardId: 'board-1',
    storyId: 'story-1',
    content: dirty,
    savedContent: dirty,
  });
  await jest.advanceTimersByTimeAsync(400);
  expect(await readCanvasDraft('board', 'story-1', 'board-1')).toBeNull();
});
