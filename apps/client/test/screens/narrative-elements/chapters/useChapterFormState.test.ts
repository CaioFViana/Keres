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
import type { ChapterService } from '../../../../src/services/storymanagement/ChapterService';

const createChapterServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as ChapterService,
});
const drizzleDb = {} as never;

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
      drizzleDb,
      chapterServiceRef,
      customFields: options.customFields ?? [],
    }),
  );
  return { chapterServiceRef, view };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetValuesForEntity.mockResolvedValue([]);
  mockReadSecondaryDraft.mockResolvedValue(null);
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
      drizzleDb,
      chapterServiceRef,
      customFields: [],
    }),
  );

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(error).toHaveBeenCalledWith('Failed to load chapter:', expect.any(Error));
  error.mockRestore();
});
