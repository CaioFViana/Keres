/** @jest-environment node */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockGetValuesForEntity = jest.fn();

jest.mock('../../../src/services/storymanagement/AttributeValueService', () => ({
  createAttributeValueService: () => ({ getValuesForEntity: mockGetValuesForEntity }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { StorySchemaField } from '@keres/shared';
import { useNoteFormState } from '../../../src/screens/notes/useNoteFormState';
import {
  resetEditorDraftDbForTests,
  setEditorDraftDb,
} from '../../../src/services/EditorDraftService';
import type { NoteService } from '../../../src/services/storymanagement/NoteService';
import { createTestDatabase, type TestDatabase } from '../../helpers/testDb';

let database: TestDatabase;

const createNoteServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as NoteService,
});

const renderState = async (options: {
  initialNoteId?: string;
  storyId?: string;
  note?: object | null;
  customFields?: StorySchemaField[];
  serviceRef?: { current: NoteService | null };
}) => {
  const noteServiceRef = options.serviceRef ?? createNoteServiceRef();
  if (options.note !== undefined && noteServiceRef.current) {
    (noteServiceRef.current.getById as jest.Mock).mockResolvedValue(options.note);
  }
  const view = await renderHook(() =>
    useNoteFormState({
      initialNoteId: options.initialNoteId,
      storyId: options.storyId ?? 'story-1',
      drizzleDb: database.db,
      noteServiceRef,
      customFields: options.customFields ?? [],
    }),
  );
  return { noteServiceRef, view };
};

const persistedNote = {
  title: 'Anotações do Condado',
  body: 'Coisas a lembrar',
  isFavorite: false,
  extraNotes: null,
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

it('starts a creation form with custom defaults and editing off', async () => {
  const customFields = [{ id: 'field-1', defaultValue: 'fallback' }] as StorySchemaField[];
  const { noteServiceRef, view } = await renderState({ customFields });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.isEditing).toBe(false);
  expect(view.result.current.title).toBe('');
  expect(view.result.current.customValues).toEqual({ 'field-1': 'fallback' });
  expect(noteServiceRef.current!.getById).not.toHaveBeenCalled();
});

it('retains a newly persisted note id without refetching', async () => {
  const { noteServiceRef, view } = await renderState({});

  await waitFor(() => expect(view.result.current.loading).toBe(false));
  await act(async () => {
    view.result.current.setTitle('Draft');
    view.result.current.retainPersistedNoteId('note-created');
  });

  expect(view.result.current.title).toBe('Draft');
  expect(view.result.current.currentNoteId).toBe('note-created');
  expect(view.result.current.isEditing).toBe(true);
  expect(noteServiceRef.current!.getById).not.toHaveBeenCalled();
});

it('hydrates the note and its stored custom values', async () => {
  mockGetValuesForEntity.mockResolvedValue([{ fieldId: 'field-1', value: 'stored' }]);
  const { noteServiceRef, view } = await renderState({
    initialNoteId: 'note-1',
    note: {
      title: 'Existing',
      body: 'Body',
      isFavorite: true,
      extraNotes: 'side',
    },
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(noteServiceRef.current!.getById).toHaveBeenCalledWith('note-1');
  expect(mockGetValuesForEntity).toHaveBeenCalledWith('note-1');
  expect(view.result.current.title).toBe('Existing');
  expect(view.result.current.body).toBe('Body');
  expect(view.result.current.isFavorite).toBe(true);
  expect(view.result.current.customValues).toEqual({ 'field-1': 'stored' });
});

it('warns and finishes loading when the note is missing', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { view } = await renderState({ initialNoteId: 'missing', note: null });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(warn).toHaveBeenCalledWith('Note not found:', 'missing');
  expect(view.result.current.title).toBe('');
  warn.mockRestore();
});

it('finishes loading without a service instead of hanging', async () => {
  const { view } = await renderState({ serviceRef: { current: null } });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.isEditing).toBe(false);
});

it('logs and finishes loading when hydration fails', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const noteServiceRef = createNoteServiceRef();
  (noteServiceRef.current.getById as jest.Mock).mockRejectedValue(new Error('db down'));
  const view = await renderHook(() =>
    useNoteFormState({
      initialNoteId: 'note-1',
      storyId: 'story-1',
      drizzleDb: database.db,
      noteServiceRef,
      customFields: [],
    }),
  );

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(error).toHaveBeenCalledWith('Failed to load note:', expect.any(Error));
  error.mockRestore();
});

describe('useNoteFormState durable drafts', () => {
  it('restores typed creation content after a navigation round-trip', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setTitle('Ideias para Moria');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.title).toBe('Ideias para Moria');
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
    expect(second.result.current.title).toBe('');
  });

  it('restores edits over the loaded database values', async () => {
    const { view: first } = await renderState({ initialNoteId: 'note-1', note: persistedNote });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.title).toBe('Anotações do Condado');

    await act(async () => {
      first.result.current.setTitle('Anotações do Condado, revisadas');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({ initialNoteId: 'note-1', note: persistedNote });
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.title).toBe('Anotações do Condado, revisadas');
    expect(second.result.current.body).toBe('Coisas a lembrar');
  });

  it('resets a creation back to blanks and drops the stored draft', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setTitle('Ideias para Moria');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.title).toBe('');
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    // Nothing comes back: the draft died with the reset, and tracking re-armed instead.
    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.title).toBe('');

    // ...so typing again drafts again.
    await act(async () => {
      second.result.current.setTitle('Mapas de Erebor');
    });
    await act(async () => {
      second.unmount();
    });
    const { view: third } = await renderState({});
    await waitFor(() => expect(third.result.current.draftRestored).toBe(true));
    expect(third.result.current.title).toBe('Mapas de Erebor');
  });

  it('resets an edit back to the saved values and drops the stored draft', async () => {
    const { view: first } = await renderState({ initialNoteId: 'note-1', note: persistedNote });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setTitle('Rascunho');
      first.result.current.setIsFavorite(true);
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.title).toBe('Anotações do Condado');
    expect(first.result.current.isFavorite).toBe(false);
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({ initialNoteId: 'note-1', note: persistedNote });
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.title).toBe('Anotações do Condado');
  });

  it('discards the draft when the entity was saved elsewhere since', async () => {
    const { view: first } = await renderState({ initialNoteId: 'note-1', note: persistedNote });
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setTitle('Rascunho velho');
    });
    await act(async () => {
      first.unmount();
    });

    const newerNote = {
      ...persistedNote,
      title: 'Anotações refeitas',
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    const { view: second } = await renderState({ initialNoteId: 'note-1', note: newerNote });
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.title).toBe('Anotações refeitas');
  });
});
