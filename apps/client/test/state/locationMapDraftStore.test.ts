/**
 * @jest-environment node
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readCanvasDraft, writeCanvasDraftNow } from '../../src/services/canvasDraftPersistence';
import {
  readEditorDraft,
  resetEditorDraftDbForTests,
  setEditorDraftDb,
} from '../../src/services/EditorDraftService';
import { useLocationMapDraftStore } from '../../src/state/locationMapDraftStore';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/**
 * The location-map draft store: same contract as the board draft store, one deliberate
 * difference - `reset` stays memory-only because the board reset already clears every canvas
 * draft key. The behaviors pinned here are the durable round-trip (an unsaved drawing survives
 * process death until it matches the saved map), the in-memory fast path on hydrate, and the
 * per-map retention when navigating between maps (the outgoing drawing is flushed, not dropped).
 */

const empty = { images: [], nodes: [] };
const dirty = {
  images: [],
  nodes: [{ id: 'harbor', locationId: 'loc-harbor', x: 10, y: 10, icon: 'map', color: '#ff0000' }],
};

beforeEach(async () => {
  jest.useRealTimers();
  await AsyncStorage.clear();
  useLocationMapDraftStore.getState().reset();
});

it('keeps the unsaved drawing for the same map', () => {
  useLocationMapDraftStore.getState().remember({
    mapId: 'map-1',
    storyId: 'story-1',
    content: dirty,
    savedContent: empty,
  });

  expect(useLocationMapDraftStore.getState().draft?.mapId).toBe('map-1');
  expect(useLocationMapDraftStore.getState().draft?.content.nodes).toHaveLength(1);
});

it('hydrates a durable draft after memory was cleared', async () => {
  jest.useFakeTimers();
  useLocationMapDraftStore.getState().remember({
    mapId: 'map-1',
    storyId: 'story-1',
    content: dirty,
    savedContent: empty,
  });
  await jest.advanceTimersByTimeAsync(400);
  useLocationMapDraftStore.setState({ draft: null });

  const restored = await useLocationMapDraftStore.getState().hydrate('story-1', 'map-1');

  expect(restored?.content.nodes).toHaveLength(1);
  expect(useLocationMapDraftStore.getState().draft?.mapId).toBe('map-1');
});

it('returns the in-memory drawing when hydrating the same map', async () => {
  useLocationMapDraftStore.getState().remember({
    mapId: 'map-1',
    storyId: 'story-1',
    content: dirty,
    savedContent: empty,
  });

  const restored = await useLocationMapDraftStore.getState().hydrate('story-1', 'map-1');

  expect(restored?.mapId).toBe('map-1');
});

it('flushes the outgoing drawing when hydrating another map, and restores it back', async () => {
  useLocationMapDraftStore.getState().remember({
    mapId: 'map-1',
    storyId: 'story-1',
    content: dirty,
    savedContent: empty,
  });

  // Switching away flushes map-1 immediately, even before the debounce fires.
  await expect(useLocationMapDraftStore.getState().hydrate('story-1', 'map-2')).resolves.toBeNull();
  expect(useLocationMapDraftStore.getState().draft).toBeNull();
  expect(await readCanvasDraft('location-map', 'story-1', 'map-1')).not.toBeNull();

  const restored = await useLocationMapDraftStore.getState().hydrate('story-1', 'map-1');
  expect(restored?.content.nodes).toHaveLength(1);
});

it('does not keep a durable draft when content matches savedContent', async () => {
  jest.useFakeTimers();
  useLocationMapDraftStore.getState().remember({
    mapId: 'map-1',
    storyId: 'story-1',
    content: dirty,
    savedContent: dirty,
  });
  await jest.advanceTimersByTimeAsync(400);

  expect(await readCanvasDraft('location-map', 'story-1', 'map-1')).toBeNull();
});

it('clears the drawing and its durable copy together, and resets memory-only', async () => {
  jest.useFakeTimers();
  useLocationMapDraftStore.getState().remember({
    mapId: 'map-1',
    storyId: 'story-1',
    content: dirty,
    savedContent: empty,
  });
  await jest.advanceTimersByTimeAsync(400);

  useLocationMapDraftStore.getState().clear();
  expect(useLocationMapDraftStore.getState().draft).toBeNull();
  expect(await readCanvasDraft('location-map', 'story-1', 'map-1')).toBeNull();

  // `reset` drops memory only: the board reset owns the durable keys.
  useLocationMapDraftStore.getState().remember({
    mapId: 'map-1',
    storyId: 'story-1',
    content: dirty,
    savedContent: empty,
  });
  await jest.advanceTimersByTimeAsync(400);
  useLocationMapDraftStore.getState().reset();
  expect(useLocationMapDraftStore.getState().draft).toBeNull();
  expect(await readCanvasDraft('location-map', 'story-1', 'map-1')).not.toBeNull();
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
    useLocationMapDraftStore.getState().remember({
      mapId: 'map-1',
      storyId: 'story-1',
      content: dirty,
      savedContent: empty,
    });
    await jest.advanceTimersByTimeAsync(400);

    const row = await readEditorDraft(database.db, 'story-1', 'LocationMap', 'map-1', 'content');
    expect(JSON.parse(row!.content)).toMatchObject({ mapId: 'map-1' });
    expect(await readCanvasDraft('location-map', 'story-1', 'map-1')).toBeNull();

    useLocationMapDraftStore.setState({ draft: null });
    const restored = await useLocationMapDraftStore.getState().hydrate('story-1', 'map-1');
    expect(restored?.content.nodes).toHaveLength(1);
  });

  it('adopts a legacy AsyncStorage draft into SQLite on hydrate', async () => {
    await writeCanvasDraftNow('location-map', 'story-1', 'map-1', {
      mapId: 'map-1',
      storyId: 'story-1',
      content: dirty,
      savedContent: empty,
    });

    const restored = await useLocationMapDraftStore.getState().hydrate('story-1', 'map-1');

    expect(restored?.content.nodes).toHaveLength(1);
    const row = await readEditorDraft(database.db, 'story-1', 'LocationMap', 'map-1', 'content');
    expect(row).not.toBeNull();
    expect(await readCanvasDraft('location-map', 'story-1', 'map-1')).toBeNull();
  });

  it('keeps each unsaved map when switching between maps', async () => {
    const otherDirty = {
      images: [],
      nodes: [
        { id: 'tower', locationId: 'loc-tower', x: 30, y: 30, icon: 'map', color: '#00ff00' },
      ],
    };
    useLocationMapDraftStore.getState().remember({
      mapId: 'map-1',
      storyId: 'story-1',
      content: dirty,
      savedContent: empty,
    });
    // Switch away before the debounce fires: the outgoing drawing must be flushed, not dropped.
    await expect(
      useLocationMapDraftStore.getState().hydrate('story-1', 'map-2'),
    ).resolves.toBeNull();
    useLocationMapDraftStore.getState().remember({
      mapId: 'map-2',
      storyId: 'story-1',
      content: otherDirty,
      savedContent: empty,
    });

    const backToFirst = await useLocationMapDraftStore.getState().hydrate('story-1', 'map-1');
    expect(backToFirst?.content.nodes).toHaveLength(1);

    const backToSecond = await useLocationMapDraftStore.getState().hydrate('story-1', 'map-2');
    expect(backToSecond?.content.nodes).toHaveLength(1);
  });
});
