/** @jest-environment node */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import {
  FORM_DRAFT_FIELD,
  NEW_ENTITY_DRAFT_ID,
  useDurableFormDraft,
} from '../../src/hooks/useDurableFormDraft';
import {
  readEditorDraft,
  resetEditorDraftDbForTests,
  setEditorDraftDb,
  writeEditorDraft,
} from '../../src/services/EditorDraftService';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

type Fields = { name: string; description: string | null };

const PRISTINE: Fields = { name: '', description: null };
const DIRTY: Fields = { name: 'Minas Tirith', description: null };

let database: TestDatabase;

async function storedRow(entityId: string = NEW_ENTITY_DRAFT_ID) {
  return readEditorDraft(database.db, 'story-1', 'Location', entityId, FORM_DRAFT_FIELD);
}

async function seedRow(fields: Fields, baseUpdatedAt: string | null = null) {
  await writeEditorDraft(
    database.db,
    'story-1',
    'Location',
    NEW_ENTITY_DRAFT_ID,
    FORM_DRAFT_FIELD,
    JSON.stringify({ fields, baseUpdatedAt }),
  );
}

function useHarness(options: {
  enabled?: boolean;
  entityId?: string;
  field?: string;
  pristine?: Fields;
  baseUpdatedAt?: string | null;
  onRestore?: (fields: Fields) => void;
}) {
  const [snapshot, setSnapshot] = useState<Fields>(PRISTINE);
  const draft = useDurableFormDraft<Fields>({
    storyId: 'story-1',
    entityType: 'Location',
    field: options.field,
    entityId: options.entityId,
    enabled: options.enabled ?? true,
    snapshot,
    pristine: options.pristine ?? PRISTINE,
    baseUpdatedAt: options.baseUpdatedAt,
    onRestore: options.onRestore ?? (() => {}),
  });
  return { snapshot, setSnapshot, draft };
}

beforeEach(async () => {
  database = await createTestDatabase();
  setEditorDraftDb(database.db);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  resetEditorDraftDbForTests();
  database.close();
  jest.restoreAllMocks();
});

describe('useDurableFormDraft', () => {
  it('restores the stored snapshot over the initial values on mount', async () => {
    await seedRow(DIRTY);
    const onRestore = jest.fn();

    const view = await renderHook(() => useHarness({ onRestore }));

    await waitFor(() => expect(onRestore).toHaveBeenCalledWith(DIRTY));
    expect(view.result.current.draft.draftRestored).toBe(true);
  });

  it('does not restore before the initial load finishes', async () => {
    await seedRow(DIRTY);
    const onRestore = jest.fn();

    const view = await renderHook(() => useHarness({ enabled: false, onRestore }));
    await act(async () => {});

    expect(onRestore).not.toHaveBeenCalled();
    expect(view.result.current.draft.draftRestored).toBe(false);
  });

  it('writes a debounced draft while the snapshot differs from pristine', async () => {
    jest.useFakeTimers();
    const view = await renderHook(() => useHarness({}));

    await act(async () => {
      view.result.current.setSnapshot(DIRTY);
    });
    expect(await storedRow()).toBeNull();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(500);
    });
    const row = await storedRow();
    expect(row).not.toBeNull();
    expect(JSON.parse(row!.content)).toMatchObject({ fields: DIRTY });
    jest.useRealTimers();
  });

  it('writes nothing while the snapshot matches pristine', async () => {
    jest.useFakeTimers();
    await renderHook(() => useHarness({}));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });

    expect(await storedRow()).toBeNull();
    jest.useRealTimers();
  });

  it('removes the row again when the user reverts to pristine', async () => {
    jest.useFakeTimers();
    const view = await renderHook(() => useHarness({}));

    await act(async () => {
      view.result.current.setSnapshot(DIRTY);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(500);
    });
    expect(await storedRow()).not.toBeNull();

    await act(async () => {
      view.result.current.setSnapshot(PRISTINE);
    });
    await waitFor(async () => expect(await storedRow()).toBeNull());
    jest.useRealTimers();
  });

  it('discards a draft saved against an older entity version', async () => {
    await seedRow(DIRTY, '2026-01-01T00:00:00.000Z');
    const onRestore = jest.fn();

    const view = await renderHook(() =>
      useHarness({ entityId: 'loc-1', baseUpdatedAt: '2026-02-01T00:00:00.000Z', onRestore }),
    );
    await act(async () => {});

    expect(onRestore).not.toHaveBeenCalled();
    expect(view.result.current.draft.draftRestored).toBe(false);
  });

  it('restores when the entity version matches the draft base', async () => {
    await writeEditorDraft(
      database.db,
      'story-1',
      'Location',
      'loc-1',
      FORM_DRAFT_FIELD,
      JSON.stringify({ fields: DIRTY, baseUpdatedAt: '2026-02-01T00:00:00.000Z' }),
    );
    const onRestore = jest.fn();

    await renderHook(() =>
      useHarness({ entityId: 'loc-1', baseUpdatedAt: '2026-02-01T00:00:00.000Z', onRestore }),
    );

    await waitFor(() => expect(onRestore).toHaveBeenCalledWith(DIRTY));
  });

  it('drops a corrupt row instead of restoring it', async () => {
    await writeEditorDraft(
      database.db,
      'story-1',
      'Location',
      NEW_ENTITY_DRAFT_ID,
      FORM_DRAFT_FIELD,
      '{not-json',
    );
    const onRestore = jest.fn();

    await renderHook(() => useHarness({ onRestore }));
    await act(async () => {});

    expect(onRestore).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
    await waitFor(async () => expect(await storedRow()).toBeNull());
  });

  it('clears on demand and never writes again afterwards', async () => {
    jest.useFakeTimers();
    const view = await renderHook(() => useHarness({}));

    await act(async () => {
      view.result.current.setSnapshot(DIRTY);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(500);
    });
    expect(await storedRow()).not.toBeNull();

    await act(async () => {
      await view.result.current.draft.clearFormDraft();
    });
    await act(async () => {
      view.result.current.setSnapshot({ name: 'Depois', description: null });
      await jest.advanceTimersByTimeAsync(1000);
    });

    expect(await storedRow()).toBeNull();
    jest.useRealTimers();
  });

  it('flushes the latest keystrokes on unmount inside the debounce window', async () => {
    jest.useFakeTimers();
    const view = await renderHook(() => useHarness({}));

    await act(async () => {
      view.result.current.setSnapshot(DIRTY);
    });
    expect(await storedRow()).toBeNull();

    await act(async () => {
      view.unmount();
    });

    // No timer advanced: the unmount flush wrote it.
    expect(await storedRow()).not.toBeNull();
    jest.useRealTimers();
  });

  it('isolates drafts by field when a custom field is given', async () => {
    jest.useFakeTimers();
    await writeEditorDraft(
      database.db,
      'story-1',
      'Location',
      NEW_ENTITY_DRAFT_ID,
      'body',
      JSON.stringify({ fields: DIRTY, baseUpdatedAt: null }),
    );
    const onRestore = jest.fn();
    const view = await renderHook(() => useHarness({ field: 'body', onRestore }));

    await waitFor(() => expect(onRestore).toHaveBeenCalledWith(DIRTY));
    expect(view.result.current.draft.draftRestored).toBe(true);

    await act(async () => {
      await view.result.current.draft.clearFormDraft();
    });
    expect(
      await readEditorDraft(database.db, 'story-1', 'Location', NEW_ENTITY_DRAFT_ID, 'body'),
    ).toBeNull();
    expect(await storedRow()).toBeNull();
    jest.useRealTimers();
  });

  it('does nothing when no database is bound', async () => {
    resetEditorDraftDbForTests();
    const onRestore = jest.fn();

    const view = await renderHook(() => useHarness({ onRestore }));
    await act(async () => {
      view.result.current.setSnapshot(DIRTY);
    });
    await act(async () => {
      await view.result.current.draft.clearFormDraft();
    });

    expect(onRestore).not.toHaveBeenCalled();
    expect(view.result.current.draft.draftRestored).toBe(false);
  });
});
