/**
 * @jest-environment node
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  readEditorDraft,
  resetEditorDraftDbForTests,
  setEditorDraftDb,
} from '../../src/services/EditorDraftService';
import { useBoardDraftStore } from '../../src/state/boardDraftStore';
import { readCanvasDraft, writeCanvasDraftNow } from '../../src/services/canvasDraftPersistence';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

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

it('returns the in-memory drawing when hydrating the same board', async () => {
  useBoardDraftStore.getState().remember({
    boardId: 'board-1',
    storyId: 'story-1',
    content: dirty,
    savedContent: empty,
  });

  const restored = await useBoardDraftStore.getState().hydrate('story-1', 'board-1');

  expect(restored?.boardId).toBe('board-1');
  expect(restored?.content.nodes).toHaveLength(1);
});

it('drops another board drawing when hydrating, and reports nothing durable', async () => {
  useBoardDraftStore.getState().remember({
    boardId: 'board-1',
    storyId: 'story-1',
    content: dirty,
    savedContent: empty,
  });

  // No durable copy was flushed, so the other board's drawing is dropped and nothing comes back.
  await expect(useBoardDraftStore.getState().hydrate('story-1', 'board-2')).resolves.toBeNull();
  expect(useBoardDraftStore.getState().draft).toBeNull();
  expect(await readCanvasDraft('board', 'story-1', 'board-1')).toBeNull();
});

it('clears the drawing and its durable copy together', async () => {
  jest.useFakeTimers();
  useBoardDraftStore.getState().remember({
    boardId: 'board-1',
    storyId: 'story-1',
    content: dirty,
    savedContent: empty,
  });
  await jest.advanceTimersByTimeAsync(400);
  expect(await readCanvasDraft('board', 'story-1', 'board-1')).not.toBeNull();

  useBoardDraftStore.getState().clear();

  expect(useBoardDraftStore.getState().draft).toBeNull();
  expect(await readCanvasDraft('board', 'story-1', 'board-1')).toBeNull();
  // Clearing nothing is a no-op, not an error.
  useBoardDraftStore.getState().clear();
});

describe('with a bound database', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = await createTestDatabase();
    setEditorDraftDb(database.db);
  });

  afterEach(() => {
    resetEditorDraftDbForTests();
    database.close();
  });

  it('persists through SQLite instead of AsyncStorage', async () => {
    jest.useFakeTimers();
    useBoardDraftStore.getState().remember({
      boardId: 'board-1',
      storyId: 'story-1',
      content: dirty,
      savedContent: empty,
    });
    await jest.advanceTimersByTimeAsync(400);

    const row = await readEditorDraft(database.db, 'story-1', 'Board', 'board-1', 'content');
    expect(JSON.parse(row!.content)).toMatchObject({ boardId: 'board-1' });
    expect(await readCanvasDraft('board', 'story-1', 'board-1')).toBeNull();

    useBoardDraftStore.setState({ draft: null });
    const restored = await useBoardDraftStore.getState().hydrate('story-1', 'board-1');
    expect(restored?.content.nodes).toHaveLength(1);
  });

  it('adopts a legacy AsyncStorage draft into SQLite on hydrate', async () => {
    await writeCanvasDraftNow('board', 'story-1', 'board-1', {
      boardId: 'board-1',
      storyId: 'story-1',
      content: dirty,
      savedContent: empty,
    });

    const restored = await useBoardDraftStore.getState().hydrate('story-1', 'board-1');

    expect(restored?.content.nodes).toHaveLength(1);
    const row = await readEditorDraft(database.db, 'story-1', 'Board', 'board-1', 'content');
    expect(row).not.toBeNull();
    expect(await readCanvasDraft('board', 'story-1', 'board-1')).toBeNull();
  });

  it('prefers the SQLite copy over a stale legacy one', async () => {
    jest.useFakeTimers();
    await writeCanvasDraftNow('board', 'story-1', 'board-1', {
      boardId: 'board-1',
      storyId: 'story-1',
      content: empty,
      savedContent: empty,
    });
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
  });
});
