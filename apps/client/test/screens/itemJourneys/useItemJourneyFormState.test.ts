/** @jest-environment node */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useItemJourneyFormState } from '../../../src/screens/itemJourneys/useItemJourneyFormState';
import {
  resetEditorDraftDbForTests,
  setEditorDraftDb,
} from '../../../src/services/EditorDraftService';
import type { ItemJourneyService } from '../../../src/services/storymanagement/ItemJourneyService';
import { createTestDatabase, type TestDatabase } from '../../helpers/testDb';

let database: TestDatabase;

const createItemJourneyServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as ItemJourneyService,
});

const renderState = async (options?: {
  initialItemJourneyId?: string;
  prefilledItemId?: string;
  journey?: object;
  storyId?: string;
}) => {
  const itemJourneyServiceRef = createItemJourneyServiceRef();
  if (options?.journey) {
    (itemJourneyServiceRef.current!.getById as jest.Mock).mockResolvedValue(options.journey);
  }
  const view = await renderHook(() =>
    useItemJourneyFormState({
      initialItemJourneyId: options?.initialItemJourneyId,
      prefilledItemId: options?.prefilledItemId,
      storyId: options?.storyId ?? 'story-1',
      itemJourneyServiceRef,
    }),
  );
  return { itemJourneyServiceRef, view };
};

const persistedJourney = {
  itemId: 'item-2',
  sceneId: 'scene-3',
  newCharacterOwnerId: 'character-4',
  newState: 'Reforjada',
  extraNotes: 'Uma nota',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  database = await createTestDatabase();
  setEditorDraftDb(database.db);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  resetEditorDraftDbForTests();
  database.close();
  jest.restoreAllMocks();
});

it('keeps the prefilled item for a new journey without hydrating', async () => {
  const { itemJourneyServiceRef, view } = await renderState({ prefilledItemId: 'item-1' });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.itemId).toBe('item-1');
  expect(view.result.current.isEditing).toBe(false);
  expect(itemJourneyServiceRef.current!.getById).not.toHaveBeenCalled();
});

it('retains a newly created journey id without touching the draft fields', async () => {
  const { view } = await renderState({ prefilledItemId: 'item-1' });

  await act(async () => {
    view.result.current.setNewState('broken');
    view.result.current.retainPersistedItemJourneyId('journey-created');
  });

  expect(view.result.current.currentItemJourneyId).toBe('journey-created');
  expect(view.result.current.newState).toBe('broken');
  expect(view.result.current.itemId).toBe('item-1');
});

it('hydrates the journey supplied when the form opens', async () => {
  const { itemJourneyServiceRef, view } = await renderState({
    initialItemJourneyId: 'journey-existing',
    journey: {
      itemId: 'item-2',
      sceneId: 'scene-3',
      newCharacterOwnerId: 'character-4',
      newState: 'reforged',
      extraNotes: 'a note',
    },
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(itemJourneyServiceRef.current!.getById).toHaveBeenCalledWith('journey-existing');
  expect(view.result.current.itemId).toBe('item-2');
  expect(view.result.current.sceneId).toBe('scene-3');
  expect(view.result.current.newCharacterOwnerId).toBe('character-4');
  expect(view.result.current.newState).toBe('reforged');
  expect(view.result.current.extraNotes).toBe('a note');
  expect(view.result.current.isEditing).toBe(true);
});

it('finishes loading without a service even when an id was supplied', async () => {
  const view = await renderHook(() =>
    useItemJourneyFormState({
      initialItemJourneyId: 'journey-existing',
      storyId: 'story-1',
      itemJourneyServiceRef: { current: null },
    }),
  );

  await waitFor(() => expect(view.result.current.loading).toBe(false));
  expect(view.result.current.isEditing).toBe(true);
});

describe('useItemJourneyFormState durable drafts', () => {
  it('restores typed creation content after a navigation round-trip', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setNewState('Quebrada');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.newState).toBe('Quebrada');
  });

  it('writes no draft when nothing was typed', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.newState).toBe('');
  });

  it('restores edits over the loaded database values', async () => {
    const { view: first } = await renderState({
      initialItemJourneyId: 'journey-1',
      journey: persistedJourney,
    });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.newState).toBe('Reforjada');

    await act(async () => {
      first.result.current.setNewState('Reforjada, de novo');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({
      initialItemJourneyId: 'journey-1',
      journey: persistedJourney,
    });
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.newState).toBe('Reforjada, de novo');
    expect(second.result.current.extraNotes).toBe('Uma nota');
  });

  it('resets a creation back to blanks and drops the stored draft', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setNewState('Quebrada');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.newState).toBe('');
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    // Nothing comes back: the draft died with the reset, and tracking re-armed instead.
    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.newState).toBe('');

    // ...so typing again drafts again.
    await act(async () => {
      second.result.current.setNewState('Perdida');
    });
    await act(async () => {
      second.unmount();
    });
    const { view: third } = await renderState({});
    await waitFor(() => expect(third.result.current.draftRestored).toBe(true));
    expect(third.result.current.newState).toBe('Perdida');
  });

  it('resets an edit back to the saved values and drops the stored draft', async () => {
    const { view: first } = await renderState({
      initialItemJourneyId: 'journey-1',
      journey: persistedJourney,
    });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setNewState('Rascunho');
      first.result.current.setSceneId('scene-9');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.newState).toBe('Reforjada');
    expect(first.result.current.sceneId).toBe('scene-3');
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({
      initialItemJourneyId: 'journey-1',
      journey: persistedJourney,
    });
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.newState).toBe('Reforjada');
  });

  it('discards the draft when the entity was saved elsewhere since', async () => {
    const { view: first } = await renderState({
      initialItemJourneyId: 'journey-1',
      journey: persistedJourney,
    });
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setNewState('Rascunho velho');
    });
    await act(async () => {
      first.unmount();
    });

    const newerJourney = {
      ...persistedJourney,
      newState: 'Derretida',
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    const { view: second } = await renderState({
      initialItemJourneyId: 'journey-1',
      journey: newerJourney,
    });
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.newState).toBe('Derretida');
  });

  it('treats an item prefill as pristine and keeps it on reset', async () => {
    const { view: first } = await renderState({ prefilledItemId: 'item-9' });
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    expect(first.result.current.itemId).toBe('item-9');
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setNewState('Rascunho');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });
    expect(first.result.current.newState).toBe('');
    expect(first.result.current.itemId).toBe('item-9');
    expect(first.result.current.isDirty).toBe(false);
  });
});
