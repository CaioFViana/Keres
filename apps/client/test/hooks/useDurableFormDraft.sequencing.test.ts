/** @jest-environment node */
import { act, renderHook } from '@testing-library/react-native';
import { useState } from 'react';

jest.mock('../../src/services/EditorDraftService', () => ({
  clearBoundEditorDraft: jest.fn(async () => {}),
  isEditorDraftDbBound: jest.fn(() => true),
  readBoundEditorDraft: jest.fn(),
  scheduleWriteEditorDraft: jest.fn(),
  writeEditorDraftNow: jest.fn(async () => true),
}));

import { useDurableFormDraft } from '../../src/hooks/useDurableFormDraft';
import {
  clearBoundEditorDraft,
  readBoundEditorDraft,
  scheduleWriteEditorDraft,
} from '../../src/services/EditorDraftService';

type Fields = { name: string };

const PRISTINE: Fields = { name: '' };

const clearMock = jest.mocked(clearBoundEditorDraft);
const readMock = jest.mocked(readBoundEditorDraft);
const scheduleMock = jest.mocked(scheduleWriteEditorDraft);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

function useHarness(onRestore: (fields: Fields) => void = () => {}) {
  const [snapshot, setSnapshot] = useState<Fields>(PRISTINE);
  const draft = useDurableFormDraft<Fields>({
    storyId: 'story-1',
    entityType: 'Location',
    enabled: true,
    snapshot,
    pristine: PRISTINE,
    // Production forms apply restored fields to the snapshot source; the harness mirrors that.
    onRestore: (fields) => {
      onRestore(fields);
      setSnapshot(fields);
    },
  });
  return { setSnapshot, draft };
}

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * expo-sqlite runs async queries on concurrent queues (iOS) / a shared IO pool (Android), so two
 * queries issued in the same commit complete in no guaranteed order. On a fresh mount with
 * pristine fields the hook issues a restore-read and a pristine-clear: if the clear lands first,
 * the draft dies before the read and unsaved typing is lost without any save. Tracking must
 * therefore wait until the restore attempt settles.
 */
describe('useDurableFormDraft sequencing', () => {
  it('issues no write or delete while the restore read is still pending', async () => {
    const read = deferred<null>();
    readMock.mockReturnValueOnce(read.promise as never);

    await renderHook(() => useHarness());
    await act(async () => {});

    expect(readMock).toHaveBeenCalledTimes(1);
    expect(clearMock).not.toHaveBeenCalled();
    expect(scheduleMock).not.toHaveBeenCalled();

    read.resolve(null);
  });

  it('resumes tracking once the restore settles with no row', async () => {
    readMock.mockResolvedValueOnce(null);
    const view = await renderHook(() => useHarness());
    await act(async () => {});

    await act(async () => {
      view.result.current.setSnapshot({ name: 'Minas Tirith' });
    });

    expect(scheduleMock).toHaveBeenCalledTimes(1);
  });

  it('never clears before a pending restore resolves with a row', async () => {
    const read = deferred<{ content: string; updatedAt: Date }>();
    readMock.mockReturnValueOnce(read.promise as never);
    const onRestore = jest.fn();

    await renderHook(() => useHarness(onRestore));
    await act(async () => {});
    expect(clearMock).not.toHaveBeenCalled();

    await act(async () => {
      read.resolve({
        content: JSON.stringify({ fields: { name: 'Minas Tirith' }, baseUpdatedAt: null }),
        updatedAt: new Date(),
      });
    });

    expect(onRestore).toHaveBeenCalledWith({ name: 'Minas Tirith' });
    expect(clearMock).not.toHaveBeenCalled();
  });
});
