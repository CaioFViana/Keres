/** @jest-environment node */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useChoiceFormState } from '../../../../src/screens/narrative-elements/choices/useChoiceFormState';
import {
  resetEditorDraftDbForTests,
  setEditorDraftDb,
} from '../../../../src/services/EditorDraftService';
import type { ChoiceService } from '../../../../src/services/storymanagement/ChoiceService';
import { createTestDatabase, type TestDatabase } from '../../../helpers/testDb';

let database: TestDatabase;

const createChoiceServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as ChoiceService,
});

const renderState = async (options: {
  initialChoiceId?: string;
  initialSceneId?: string;
  storyId?: string;
  choice?: object | null;
  serviceRef?: { current: ChoiceService | null };
}) => {
  const choiceServiceRef = options.serviceRef ?? createChoiceServiceRef();
  if (options.choice !== undefined && choiceServiceRef.current) {
    (choiceServiceRef.current.getById as jest.Mock).mockResolvedValue(options.choice);
  }
  const view = await renderHook(() =>
    useChoiceFormState({
      initialChoiceId: options.initialChoiceId,
      initialSceneId: options.initialSceneId,
      storyId: options.storyId ?? 'story-1',
      choiceServiceRef,
    }),
  );
  return { choiceServiceRef, view };
};

const persistedChoice = {
  sceneId: 'scene-1',
  nextSceneId: 'scene-2',
  text: 'Abrir o portão',
  notes: 'Rangendo',
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

it('starts a creation form with the originating scene preselected', async () => {
  const { choiceServiceRef, view } = await renderState({ initialSceneId: 'scene-9' });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.sceneId).toBe('scene-9');
  expect(view.result.current.nextSceneId).toBeNull();
  expect(view.result.current.text).toBe('');
  expect(view.result.current.isEditing).toBe(false);
  expect(choiceServiceRef.current!.getById).not.toHaveBeenCalled();
});

it('retains a newly persisted choice id and exposes field setters', async () => {
  const { view } = await renderState({});

  await waitFor(() => expect(view.result.current.loading).toBe(false));
  await act(async () => {
    view.result.current.setText('Open the gate');
    view.result.current.setNotes('Loud');
    view.result.current.retainPersistedChoiceId('choice-created');
  });

  expect(view.result.current.text).toBe('Open the gate');
  expect(view.result.current.notes).toBe('Loud');
  expect(view.result.current.currentChoiceId).toBe('choice-created');
  expect(view.result.current.isEditing).toBe(true);
});

it('hydrates the choice the form opens with', async () => {
  const { choiceServiceRef, view } = await renderState({
    initialChoiceId: 'choice-1',
    choice: {
      sceneId: 'scene-1',
      nextSceneId: 'scene-2',
      text: 'Go north',
      notes: 'Cold',
    },
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(choiceServiceRef.current!.getById).toHaveBeenCalledWith('choice-1');
  expect(view.result.current.sceneId).toBe('scene-1');
  expect(view.result.current.nextSceneId).toBe('scene-2');
  expect(view.result.current.text).toBe('Go north');
  expect(view.result.current.notes).toBe('Cold');
});

it('warns and finishes loading when the choice is missing', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { view } = await renderState({ initialChoiceId: 'missing', choice: null });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(warn).toHaveBeenCalledWith('Choice not found:', 'missing');
  expect(view.result.current.text).toBe('');
  warn.mockRestore();
});

it('finishes loading without a service instead of hanging', async () => {
  const { view } = await renderState({ serviceRef: { current: null } });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.isEditing).toBe(false);
});

it('logs and finishes loading when hydration fails', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const choiceServiceRef = createChoiceServiceRef();
  (choiceServiceRef.current.getById as jest.Mock).mockRejectedValue(new Error('db down'));
  const view = await renderHook(() =>
    useChoiceFormState({
      initialChoiceId: 'choice-1',
      storyId: 'story-1',
      choiceServiceRef,
    }),
  );

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(error).toHaveBeenCalledWith('Failed to load choice:', expect.any(Error));
  error.mockRestore();
});

describe('useChoiceFormState durable drafts', () => {
  it('restores typed creation content after a navigation round-trip', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setText('Seguir pela esquerda');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.text).toBe('Seguir pela esquerda');
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
    expect(second.result.current.text).toBe('');
  });

  it('restores edits over the loaded database values', async () => {
    const { view: first } = await renderState({
      initialChoiceId: 'choice-1',
      choice: persistedChoice,
    });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.text).toBe('Abrir o portão');

    await act(async () => {
      first.result.current.setText('Abrir o portão, devagar');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({
      initialChoiceId: 'choice-1',
      choice: persistedChoice,
    });
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.text).toBe('Abrir o portão, devagar');
    expect(second.result.current.notes).toBe('Rangendo');
  });

  it('resets a creation back to blanks and drops the stored draft', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setText('Seguir pela esquerda');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.text).toBe('');
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    // Nothing comes back: the draft died with the reset, and tracking re-armed instead.
    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.text).toBe('');

    // ...so typing again drafts again.
    await act(async () => {
      second.result.current.setText('Seguir pela direita');
    });
    await act(async () => {
      second.unmount();
    });
    const { view: third } = await renderState({});
    await waitFor(() => expect(third.result.current.draftRestored).toBe(true));
    expect(third.result.current.text).toBe('Seguir pela direita');
  });

  it('resets an edit back to the saved values and drops the stored draft', async () => {
    const { view: first } = await renderState({
      initialChoiceId: 'choice-1',
      choice: persistedChoice,
    });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setText('Rascunho');
      first.result.current.setNextSceneId('scene-9');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.text).toBe('Abrir o portão');
    expect(first.result.current.nextSceneId).toBe('scene-2');
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({
      initialChoiceId: 'choice-1',
      choice: persistedChoice,
    });
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.text).toBe('Abrir o portão');
  });

  it('discards the draft when the entity was saved elsewhere since', async () => {
    const { view: first } = await renderState({
      initialChoiceId: 'choice-1',
      choice: persistedChoice,
    });
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setText('Rascunho velho');
    });
    await act(async () => {
      first.unmount();
    });

    const newerChoice = {
      ...persistedChoice,
      text: 'Fechar o portão',
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    const { view: second } = await renderState({
      initialChoiceId: 'choice-1',
      choice: newerChoice,
    });
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.text).toBe('Fechar o portão');
  });

  it('treats a scene prefill as pristine and keeps it on reset', async () => {
    const { view: first } = await renderState({ initialSceneId: 'scene-9' });
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    expect(first.result.current.sceneId).toBe('scene-9');
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setText('Rascunho');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });
    expect(first.result.current.text).toBe('');
    expect(first.result.current.sceneId).toBe('scene-9');
    expect(first.result.current.isDirty).toBe(false);
  });
});
