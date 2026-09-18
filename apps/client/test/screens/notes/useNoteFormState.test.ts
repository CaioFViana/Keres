const mockGetValuesForEntity = jest.fn();

jest.mock('../../../src/services/storymanagement/AttributeValueService', () => ({
  createAttributeValueService: () => ({ getValuesForEntity: mockGetValuesForEntity }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { StorySchemaField } from '@keres/shared';
import { useNoteFormState } from '../../../src/screens/notes/useNoteFormState';
import type { NoteService } from '../../../src/services/storymanagement/NoteService';

const createNoteServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as NoteService,
});
const drizzleDb = {} as never;

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
      drizzleDb,
      noteServiceRef,
      customFields: options.customFields ?? [],
    }),
  );
  return { noteServiceRef, view };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetValuesForEntity.mockResolvedValue([]);
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
      drizzleDb,
      noteServiceRef,
      customFields: [],
    }),
  );

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(error).toHaveBeenCalledWith('Failed to load note:', expect.any(Error));
  error.mockRestore();
});
