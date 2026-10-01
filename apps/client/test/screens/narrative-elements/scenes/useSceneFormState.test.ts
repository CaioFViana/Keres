/** @jest-environment node */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockGetValuesForEntity = jest.fn();

jest.mock('../../../../src/services/storymanagement/AttributeValueService', () => ({
  createAttributeValueService: () => ({ getValuesForEntity: mockGetValuesForEntity }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { StorySchemaField } from '@keres/shared';
import { useSceneFormState } from '../../../../src/screens/narrative-elements/scenes/useSceneFormState';
import {
  resetEditorDraftDbForTests,
  setEditorDraftDb,
} from '../../../../src/services/EditorDraftService';
import type { SceneService } from '../../../../src/services/storymanagement/SceneService';
import { createTestDatabase, type TestDatabase } from '../../../helpers/testDb';

let database: TestDatabase;

const createSceneServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as SceneService,
});
const customFields: StorySchemaField[] = [];

const renderState = async (initialSceneId?: string, scene?: object, initialChapterId?: string) => {
  const sceneServiceRef = createSceneServiceRef();
  if (scene) {
    (sceneServiceRef.current!.getById as jest.Mock).mockResolvedValue(scene);
  }
  const view = await renderHook(() =>
    useSceneFormState({
      initialSceneId,
      initialChapterId,
      storyId: 'story-1',
      drizzleDb: database.db,
      sceneServiceRef,
      customFields,
    }),
  );
  return { sceneServiceRef, view };
};

const persistedScene = {
  chapterId: 'chapter-1',
  locationId: null,
  name: 'A Sociedade do Anel',
  summary: 'Formação da sociedade',
  isFavorite: false,
  extraNotes: null,
  gap: null,
  gapType: null,
  calendarDateOverride: null,
  calendarDateOverrideCalendarId: null,
  duration: null,
  durationType: null,
  isStart: false,
  isFinish: false,
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockGetValuesForEntity.mockResolvedValue([]);
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

it('retains a newly created scene id without rehydrating over draft attributes', async () => {
  const { sceneServiceRef, view } = await renderState();

  await act(async () => {
    view.result.current.setCustomValues({ field: 'draft value' });
    view.result.current.retainPersistedSceneId('scene-created');
  });

  expect(view.result.current.currentSceneId).toBe('scene-created');
  expect(view.result.current.customValues).toEqual({ field: 'draft value' });
  expect(sceneServiceRef.current!.getById).not.toHaveBeenCalled();
  expect(mockGetValuesForEntity).not.toHaveBeenCalled();
});

it('still hydrates the scene and attributes supplied when the form opens', async () => {
  mockGetValuesForEntity.mockResolvedValue([{ fieldId: 'field', value: 'persisted value' }]);
  const { sceneServiceRef, view } = await renderState('scene-existing', {
    chapterId: 'chapter-1',
    locationId: null,
    name: 'Existing scene',
    summary: null,
    isFavorite: false,
    extraNotes: null,
    gap: null,
    gapType: null,
    calendarDateOverride: null,
    calendarDateOverrideCalendarId: null,
    duration: null,
    durationType: null,
    isStart: false,
    isFinish: false,
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(sceneServiceRef.current!.getById).toHaveBeenCalledWith('scene-existing');
  expect(mockGetValuesForEntity).toHaveBeenCalledWith('scene-existing');
  expect(view.result.current.name).toBe('Existing scene');
  expect(view.result.current.customValues).toEqual({ field: 'persisted value' });
});

describe('useSceneFormState durable drafts', () => {
  it('restores typed creation content after a navigation round-trip', async () => {
    const { view: first } = await renderState();
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setName('O Conselho de Elrond');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState();
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('O Conselho de Elrond');
  });

  it('writes no draft when nothing was typed', async () => {
    const { view: first } = await renderState();
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState();
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('');
  });

  it('restores edits over the loaded database values', async () => {
    const { view: first } = await renderState('scene-1', persistedScene);
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.name).toBe('A Sociedade do Anel');

    await act(async () => {
      first.result.current.setName('A Sociedade do Anel, revisada');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState('scene-1', persistedScene);
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('A Sociedade do Anel, revisada');
    expect(second.result.current.summary).toBe('Formação da sociedade');
  });

  it('resets a creation back to blanks and drops the stored draft', async () => {
    const { view: first } = await renderState();
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setName('O Conselho de Elrond');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.name).toBe('');
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    // Nothing comes back: the draft died with the reset, and tracking re-armed instead.
    const { view: second } = await renderState();
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('');

    // ...so typing again drafts again.
    await act(async () => {
      second.result.current.setName('A Travessia de Caradhras');
    });
    await act(async () => {
      second.unmount();
    });
    const { view: third } = await renderState();
    await waitFor(() => expect(third.result.current.draftRestored).toBe(true));
    expect(third.result.current.name).toBe('A Travessia de Caradhras');
  });

  it('resets an edit back to the saved values and drops the stored draft', async () => {
    const { view: first } = await renderState('scene-1', persistedScene);
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setName('Rascunho');
      first.result.current.setIsStart(true);
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.name).toBe('A Sociedade do Anel');
    expect(first.result.current.isStart).toBe(false);
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState('scene-1', persistedScene);
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('A Sociedade do Anel');
  });

  it('discards the draft when the entity was saved elsewhere since', async () => {
    const { view: first } = await renderState('scene-1', persistedScene);
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setName('Rascunho velho');
    });
    await act(async () => {
      first.unmount();
    });

    const newerScene = {
      ...persistedScene,
      name: 'A Sociedade refeita',
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    const { view: second } = await renderState('scene-1', newerScene);
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('A Sociedade refeita');
  });

  it('treats a chapter prefill as pristine and keeps it on reset', async () => {
    const { view: first } = await renderState(undefined, undefined, 'chapter-9');
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    expect(first.result.current.chapterId).toBe('chapter-9');
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setName('Rascunho');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });
    expect(first.result.current.name).toBe('');
    expect(first.result.current.chapterId).toBe('chapter-9');
    expect(first.result.current.isDirty).toBe(false);
  });
});
