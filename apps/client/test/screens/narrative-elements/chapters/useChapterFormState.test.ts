/** @jest-environment node */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockGetValuesForEntity = jest.fn();
const mockReadSecondaryDraft = jest.fn();

jest.mock('../../../../src/services/storymanagement/AttributeValueService', () => ({
  createAttributeValueService: () => ({ getValuesForEntity: mockGetValuesForEntity }),
}));
jest.mock('../../../../src/services/storymanagement/EntityFormSecondaryDraftStore', () => ({
  readEntityFormSecondaryDraft: (...args: unknown[]) => mockReadSecondaryDraft(...args),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { StorySchemaField } from '@keres/shared';
import { useChapterFormState } from '../../../../src/screens/narrative-elements/chapters/useChapterFormState';
import {
  resetEditorDraftDbForTests,
  setEditorDraftDb,
} from '../../../../src/services/EditorDraftService';
import type { ChapterService } from '../../../../src/services/storymanagement/ChapterService';
import { createTestDatabase, type TestDatabase } from '../../../helpers/testDb';

let database: TestDatabase;

const createChapterServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as ChapterService,
});

const renderState = async (options: {
  initialChapterId?: string;
  storyId?: string;
  activeArcId?: string | null;
  chapter?: object | null;
  customFields?: StorySchemaField[];
  serviceRef?: { current: ChapterService | null };
}) => {
  const chapterServiceRef = options.serviceRef ?? createChapterServiceRef();
  if (options.chapter !== undefined && chapterServiceRef.current) {
    (chapterServiceRef.current.getById as jest.Mock).mockResolvedValue(options.chapter);
  }
  const view = await renderHook(() =>
    useChapterFormState({
      initialChapterId: options.initialChapterId,
      storyId: options.storyId ?? 'story-1',
      activeArcId: options.activeArcId,
      drizzleDb: database.db,
      chapterServiceRef,
      customFields: options.customFields ?? [],
    }),
  );
  return { chapterServiceRef, view };
};

const persistedChapter = {
  name: 'A Longa Jornada',
  summary: 'Resumo do capítulo',
  isFavorite: false,
  extraNotes: null,
  type: 'chapter',
  arcId: 'arc-1',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockGetValuesForEntity.mockResolvedValue([]);
  mockReadSecondaryDraft.mockResolvedValue(null);
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

it('starts a creation form with the active arc, custom defaults and editing off', async () => {
  const customFields = [{ id: 'field-1', defaultValue: 'fallback' }] as StorySchemaField[];
  const { chapterServiceRef, view } = await renderState({
    activeArcId: 'arc-active',
    customFields,
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.isEditing).toBe(false);
  expect(view.result.current.arcId).toBe('arc-active');
  expect(view.result.current.customValues).toEqual({ 'field-1': 'fallback' });
  expect(chapterServiceRef.current!.getById).not.toHaveBeenCalled();
  expect(mockGetValuesForEntity).not.toHaveBeenCalled();
});

it('retains a newly persisted chapter id without refetching', async () => {
  const { chapterServiceRef, view } = await renderState({});

  await waitFor(() => expect(view.result.current.loading).toBe(false));
  await act(async () => {
    view.result.current.retainPersistedChapterId('chapter-created');
  });

  expect(view.result.current.currentChapterId).toBe('chapter-created');
  expect(view.result.current.isEditing).toBe(true);
  expect(chapterServiceRef.current!.getById).not.toHaveBeenCalled();
});

it('hydrates an event chapter and lets the secondary draft win over stored values', async () => {
  mockGetValuesForEntity.mockResolvedValue([{ fieldId: 'field-1', value: 'stored' }]);
  mockReadSecondaryDraft.mockResolvedValue({
    customValues: { 'field-1': 'draft', 'field-2': 'draft-only' },
  });
  const { chapterServiceRef, view } = await renderState({
    initialChapterId: 'chapter-1',
    chapter: {
      name: 'The turning',
      summary: 'Recap',
      isFavorite: true,
      extraNotes: 'notes',
      type: 'event',
      arcId: 'arc-2',
    },
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(chapterServiceRef.current!.getById).toHaveBeenCalledWith('chapter-1');
  expect(mockGetValuesForEntity).toHaveBeenCalledWith('chapter-1');
  expect(mockReadSecondaryDraft).toHaveBeenCalledWith('story-1', 'Chapter', 'chapter-1');
  expect(view.result.current.name).toBe('The turning');
  expect(view.result.current.isEvent).toBe(true);
  expect(view.result.current.arcId).toBe('arc-2');
  expect(view.result.current.customValues).toEqual({
    'field-1': 'draft',
    'field-2': 'draft-only',
  });
});

it('warns and finishes loading when the chapter is missing', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { view } = await renderState({ initialChapterId: 'missing', chapter: null });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(warn).toHaveBeenCalledWith('Chapter not found:', 'missing');
  expect(view.result.current.name).toBe('');
  warn.mockRestore();
});

it('finishes loading without a service or story instead of hanging', async () => {
  const { view } = await renderState({ serviceRef: { current: null } });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.isEditing).toBe(false);
});

it('logs and finishes loading when hydration fails', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const chapterServiceRef = createChapterServiceRef();
  (chapterServiceRef.current.getById as jest.Mock).mockRejectedValue(new Error('db down'));
  const view = await renderHook(() =>
    useChapterFormState({
      initialChapterId: 'chapter-1',
      storyId: 'story-1',
      drizzleDb: database.db,
      chapterServiceRef,
      customFields: [],
    }),
  );

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(error).toHaveBeenCalledWith('Failed to load chapter:', expect.any(Error));
  error.mockRestore();
});

describe('useChapterFormState durable drafts', () => {
  it('restores typed creation content after a navigation round-trip', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setName('O Retorno do Rei');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('O Retorno do Rei');
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
    expect(second.result.current.name).toBe('');
  });

  it('restores edits over the loaded database values', async () => {
    const { view: first } = await renderState({
      initialChapterId: 'chapter-1',
      chapter: persistedChapter,
    });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.name).toBe('A Longa Jornada');

    await act(async () => {
      first.result.current.setName('A Longa Jornada, revisada');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({
      initialChapterId: 'chapter-1',
      chapter: persistedChapter,
    });
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('A Longa Jornada, revisada');
    expect(second.result.current.summary).toBe('Resumo do capítulo');
  });

  it('resets a creation back to blanks and drops the stored draft', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setName('O Retorno do Rei');
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
    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('');

    // ...so typing again drafts again.
    await act(async () => {
      second.result.current.setName('As Duas Torres');
    });
    await act(async () => {
      second.unmount();
    });
    const { view: third } = await renderState({});
    await waitFor(() => expect(third.result.current.draftRestored).toBe(true));
    expect(third.result.current.name).toBe('As Duas Torres');
  });

  it('resets an edit back to the saved values and drops the stored draft', async () => {
    const { view: first } = await renderState({
      initialChapterId: 'chapter-1',
      chapter: persistedChapter,
    });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setName('Rascunho');
      first.result.current.setIsEvent(true);
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.name).toBe('A Longa Jornada');
    expect(first.result.current.isEvent).toBe(false);
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({
      initialChapterId: 'chapter-1',
      chapter: persistedChapter,
    });
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('A Longa Jornada');
  });

  it('discards the draft when the entity was saved elsewhere since', async () => {
    const { view: first } = await renderState({
      initialChapterId: 'chapter-1',
      chapter: persistedChapter,
    });
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setName('Rascunho velho');
    });
    await act(async () => {
      first.unmount();
    });

    const newerChapter = {
      ...persistedChapter,
      name: 'A Jornada refeita',
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    const { view: second } = await renderState({
      initialChapterId: 'chapter-1',
      chapter: newerChapter,
    });
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('A Jornada refeita');
  });

  it('treats an active-arc prefill as pristine and keeps it on reset', async () => {
    const { view: first } = await renderState({ activeArcId: 'arc-active' });
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    expect(first.result.current.arcId).toBe('arc-active');
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setName('Rascunho');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });
    expect(first.result.current.name).toBe('');
    expect(first.result.current.arcId).toBe('arc-active');
    expect(first.result.current.isDirty).toBe(false);
  });
});
