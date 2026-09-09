const mockAlert = jest.fn();
const mockConfirmDelete = jest.fn();
const mockSaveEntityWithSecondaryData = jest.fn();
const mockSaveValuesForEntity = jest.fn();
const mockValidateRequired = jest.fn();

jest.mock('@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields', () => ({
  validateRequiredCustomAttributes: (...args: unknown[]) => mockValidateRequired(...args),
}));
jest.mock('@/src/hooks/useAsyncOperation', () => ({
  useAsyncOperation: () => ({
    pending: false,
    run: (operation: () => Promise<void>) => operation(),
  }),
}));
jest.mock('../../../src/hooks/useConfirmDelete', () => ({
  useConfirmDelete: () => mockConfirmDelete,
}));
jest.mock('../../../src/services/storymanagement/AttributeValueService', () => ({
  createAttributeValueService: () => ({ saveValuesForEntity: mockSaveValuesForEntity }),
}));
jest.mock('../../../src/services/storymanagement/EntityFormSaveCoordinator', () => ({
  saveEntityWithSecondaryData: (...args: unknown[]) => mockSaveEntityWithSecondaryData(...args),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useNoteFormActions } from '../../../src/screens/notes/useNoteFormActions';
import type { NoteFormState } from '../../../src/screens/notes/useNoteFormState';
import type { NoteService } from '../../../src/services/storymanagement/NoteService';

const createState = (overrides: Partial<NoteFormState> = {}): NoteFormState =>
  ({
    currentNoteId: undefined,
    retainPersistedNoteId: jest.fn(),
    title: 'Draft',
    setTitle: jest.fn(),
    body: null,
    setBody: jest.fn(),
    isFavorite: false,
    setIsFavorite: jest.fn(),
    extraNotes: null,
    setExtraNotes: jest.fn(),
    customValues: {},
    setCustomValues: jest.fn(),
    loading: false,
    isEditing: false,
    ...overrides,
  }) as NoteFormState;

const noteService = {
  createNote: jest.fn(),
  updateNote: jest.fn(),
  deleteNote: jest.fn(),
} as unknown as NoteService;
const navigation = {
  goBack: jest.fn(),
};
const persistTagRelations = jest.fn();

const renderActions = (state = createState()) =>
  renderHook(() =>
    useNoteFormActions({
      state,
      customFields: [],
      drizzleDb: {} as never,
      noteServiceRef: { current: noteService },
      navigation: navigation as never,
      storyId: 'story-1',
      userId: 'user-1',
      persistTagRelations,
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockValidateRequired.mockReturnValue(undefined);
  mockSaveValuesForEntity.mockResolvedValue(undefined);
  persistTagRelations.mockResolvedValue(undefined);
  (noteService.deleteNote as jest.Mock).mockResolvedValue(undefined);
  mockSaveEntityWithSecondaryData.mockImplementation(async (options) => {
    options.onEntityPersisted('note-1');
    await options.persistSecondaryData('note-1');
    return { entityId: 'note-1', created: true };
  });
});

it('rejects a note without a title before persistence', async () => {
  const view = await renderActions(createState({ title: '  ' }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'note_title_required');
  expect(mockSaveEntityWithSecondaryData).not.toHaveBeenCalled();
});

it('coordinates persistence, success messaging and back navigation after creation', async () => {
  const state = createState({ customValues: { field: 'value' } });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(state.retainPersistedNoteId).toHaveBeenCalledWith('note-1');
  expect(persistTagRelations).toHaveBeenCalledWith('note-1');
  expect(mockSaveValuesForEntity).toHaveBeenCalledWith('user-1', 'story-1', 'Note', 'note-1', {
    field: 'value',
  });
  expect(mockAlert).toHaveBeenCalledWith('success', 'note_created_successfully');
  expect(navigation.goBack).toHaveBeenCalled();
});

it('delegates deletion and completes it with back navigation', async () => {
  const view = await renderActions(createState({ currentNoteId: 'note-1', isEditing: true }));

  await act(async () => view.result.current.handleDelete());
  const request = mockConfirmDelete.mock.calls[0][0];
  await act(async () => request.onConfirm());

  expect(noteService.deleteNote).toHaveBeenCalledWith('user-1', 'note-1');
  expect(navigation.goBack).toHaveBeenCalled();
});

it('does not show success after a secondary-write failure, then recovers on retry', async () => {
  const state = createState();
  let attempt = 0;
  mockSaveEntityWithSecondaryData.mockImplementation(async (options) => {
    options.onEntityPersisted('note-1');
    if (attempt === 0) {
      attempt += 1;
      throw new Error('secondary failed');
    }
    await options.persistSecondaryData('note-1');
    return { entityId: 'note-1', created: false };
  });

  const view = await renderActions(state);
  await act(async () => view.result.current.handleSave());
  expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_note');
  expect(navigation.goBack).not.toHaveBeenCalled();

  mockAlert.mockClear();
  await act(async () => view.result.current.handleSave());
  expect(state.retainPersistedNoteId).toHaveBeenCalledWith('note-1');
  expect(mockAlert).toHaveBeenCalledWith('success', 'note_updated_successfully');
  expect(navigation.goBack).toHaveBeenCalled();
});
