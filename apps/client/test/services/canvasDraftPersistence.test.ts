/**
 * @jest-environment node
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearAllCanvasDrafts,
  clearCanvasDraft,
  readCanvasDraft,
  scheduleWriteCanvasDraft,
  writeCanvasDraftNow,
} from '../../src/services/canvasDraftPersistence';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  jest.useRealTimers();
  await AsyncStorage.clear();
});

describe('canvasDraftPersistence', () => {
  it('round-trips a board draft immediately', async () => {
    const draft = {
      boardId: 'board-1',
      storyId: 'story-1',
      content: { nodes: [{ id: 'n1' }], edges: [] },
      savedContent: { nodes: [], edges: [] },
    };
    await writeCanvasDraftNow('board', 'story-1', 'board-1', draft);
    expect(await readCanvasDraft('board', 'story-1', 'board-1')).toEqual(draft);
    await clearCanvasDraft('board', 'story-1', 'board-1');
    expect(await readCanvasDraft('board', 'story-1', 'board-1')).toBeNull();
  });

  it('coalesces rapid scheduleWriteCanvasDraft calls', async () => {
    jest.useFakeTimers();
    scheduleWriteCanvasDraft('location-map', 'story-1', 'map-1', { version: 1 });
    scheduleWriteCanvasDraft('location-map', 'story-1', 'map-1', { version: 2 });
    await jest.advanceTimersByTimeAsync(400);
    expect(await readCanvasDraft('location-map', 'story-1', 'map-1')).toEqual({ version: 2 });
  });

  it('clearAllCanvasDrafts removes board and map keys', async () => {
    await writeCanvasDraftNow('board', 's', 'b', { a: 1 });
    await writeCanvasDraftNow('location-map', 's', 'm', { b: 2 });
    await clearAllCanvasDrafts();
    expect(await readCanvasDraft('board', 's', 'b')).toBeNull();
    expect(await readCanvasDraft('location-map', 's', 'm')).toBeNull();
  });

  it('an immediate write and a clear both cancel the pending debounced one', async () => {
    jest.useFakeTimers();
    scheduleWriteCanvasDraft('board', 's', 'b', { version: 1 });

    await writeCanvasDraftNow('board', 's', 'b', { version: 2 });
    await jest.advanceTimersByTimeAsync(1000);
    expect(await readCanvasDraft('board', 's', 'b')).toEqual({ version: 2 });

    scheduleWriteCanvasDraft('board', 's', 'b', { version: 3 });
    await clearCanvasDraft('board', 's', 'b');
    await jest.advanceTimersByTimeAsync(1000);
    expect(await readCanvasDraft('board', 's', 'b')).toBeNull();
  });

  it('reports storage failures and keeps the canvas usable', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk gone'));
      expect(await readCanvasDraft('board', 's', 'b')).toBeNull();

      jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk gone'));
      await writeCanvasDraftNow('board', 's', 'b', { version: 1 });

      jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('disk gone'));
      await clearCanvasDraft('board', 's', 'b');

      jest.spyOn(AsyncStorage, 'getAllKeys').mockRejectedValueOnce(new Error('disk gone'));
      await clearAllCanvasDrafts();

      expect(console.error).toHaveBeenCalledTimes(4);
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('reports a debounced write failure without throwing into the timer', async () => {
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk gone'));
      scheduleWriteCanvasDraft('board', 's', 'b', { version: 1 });

      await jest.advanceTimersByTimeAsync(1000);

      expect(console.error).toHaveBeenCalledWith(
        'Failed to write board canvas draft:',
        expect.any(Error),
      );
    } finally {
      jest.restoreAllMocks();
    }
  });
});
