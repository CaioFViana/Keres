/**
 * @jest-environment node
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  appendStroke,
  decodeSketchDocument,
  emptySketchContent,
  type SketchDocument,
  type SketchStroke,
} from '@keres/shared';
import {
  readEditorDraft,
  resetEditorDraftDbForTests,
  setEditorDraftDb,
} from '../../src/services/EditorDraftService';
import { readCanvasDraft } from '../../src/services/canvasDraftPersistence';
import { useSketchDraftStore } from '../../src/state/sketchDraftStore';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const stroke: SketchStroke = {
  kind: 'stroke',
  brush: 'pen',
  color: '#112233',
  alpha: 1,
  size: 3,
  points: [0, 0, 40, 20, 80, 0],
};

const saved: SketchDocument = decodeSketchDocument(emptySketchContent('ABCDEFGH', 'Layer 1'));
const drawn: SketchDocument = appendStroke(saved, 'ABCDEFGH', stroke);

const draftOf = (doc: SketchDocument, sketchId = 'sketch-1') => ({
  sketchId,
  storyId: 'story-1',
  doc,
  savedDoc: saved,
  baseVersion: 3,
});

afterEach(() => jest.restoreAllMocks());

beforeEach(async () => {
  jest.useRealTimers();
  await AsyncStorage.clear();
  useSketchDraftStore.getState().reset();
});

it('keeps the unsaved drawing in memory for the same sketch', () => {
  useSketchDraftStore.getState().remember(draftOf(drawn));
  expect(useSketchDraftStore.getState().draft?.doc).toBe(drawn);
});

it('waits for the drawing to rest before writing, then writes encoded content once', async () => {
  jest.useFakeTimers();
  useSketchDraftStore.getState().remember(draftOf(drawn));
  await jest.advanceTimersByTimeAsync(400);
  expect(await readCanvasDraft('sketch', 'story-1', 'sketch-1')).toBeNull();
  await jest.advanceTimersByTimeAsync(1000);
  const stored = await readCanvasDraft<{
    baseVersion: number;
    content: { layers: { data: string }[] };
  }>('sketch', 'story-1', 'sketch-1');
  expect(stored?.baseVersion).toBe(3);
  expect(stored?.content.layers[0].data).not.toBe('');
  // No second copy of the saved drawing travels with the draft.
  expect(JSON.stringify(stored)).not.toContain('savedContent');
});

it('does not keep a durable draft when the document is the saved one', async () => {
  jest.useFakeTimers();
  useSketchDraftStore.getState().remember(draftOf(saved));
  await jest.advanceTimersByTimeAsync(2000);
  expect(await readCanvasDraft('sketch', 'story-1', 'sketch-1')).toBeNull();
});

it('hydrates a durable draft after memory was cleared, keeping the base version', async () => {
  useSketchDraftStore.getState().remember(draftOf(drawn));
  await useSketchDraftStore.getState().flush();
  useSketchDraftStore.setState({ draft: null });

  const restored = await useSketchDraftStore.getState().hydrate('story-1', 'sketch-1');
  expect(restored?.baseVersion).toBe(3);
  expect(restored?.doc.layers[0].items).toHaveLength(1);
});

it('flushes the outgoing sketch when switching to another, and restores it back', async () => {
  useSketchDraftStore.getState().remember(draftOf(drawn));
  await expect(useSketchDraftStore.getState().hydrate('story-1', 'sketch-2')).resolves.toBeNull();
  expect(useSketchDraftStore.getState().draft).toBeNull();
  expect(await readCanvasDraft('sketch', 'story-1', 'sketch-1')).not.toBeNull();

  const restored = await useSketchDraftStore.getState().hydrate('story-1', 'sketch-1');
  expect(restored?.doc.layers[0].items).toHaveLength(1);
});

it('flush writes a draft still waiting out its delay and is a no-op otherwise', async () => {
  await useSketchDraftStore.getState().flush();
  useSketchDraftStore.getState().remember(draftOf(drawn));
  await useSketchDraftStore.getState().flush();
  expect(await readCanvasDraft('sketch', 'story-1', 'sketch-1')).not.toBeNull();
});

it('clears the drawing and its durable copy together', async () => {
  useSketchDraftStore.getState().remember(draftOf(drawn));
  await useSketchDraftStore.getState().flush();
  useSketchDraftStore.getState().clear();
  expect(useSketchDraftStore.getState().draft).toBeNull();
  expect(await readCanvasDraft('sketch', 'story-1', 'sketch-1')).toBeNull();
  useSketchDraftStore.getState().clear();
});

it('drops a durable draft that no longer validates instead of half-loading it', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await AsyncStorage.setItem(
    'keres:canvas-draft:sketch:story-1:sketch-1',
    JSON.stringify({
      sketchId: 'sketch-1',
      storyId: 'story-1',
      baseVersion: 1,
      content: {
        page: { width: 794, height: 1123 },
        layers: [{ id: 'ABCDEFGH', name: 'L', data: 'AAAA' }],
        overlays: [],
      },
    }),
  );
  await expect(useSketchDraftStore.getState().hydrate('story-1', 'sketch-1')).resolves.toBeNull();
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
    useSketchDraftStore.getState().remember(draftOf(drawn));
    await useSketchDraftStore.getState().flush();

    const row = await readEditorDraft(database.db, 'story-1', 'Sketch', 'sketch-1', 'content');
    expect(JSON.parse(row!.content)).toMatchObject({ sketchId: 'sketch-1', baseVersion: 3 });
    expect(await readCanvasDraft('sketch', 'story-1', 'sketch-1')).toBeNull();

    useSketchDraftStore.setState({ draft: null });
    const restored = await useSketchDraftStore.getState().hydrate('story-1', 'sketch-1');
    expect(restored?.doc.layers[0].items).toHaveLength(1);
  });
});
