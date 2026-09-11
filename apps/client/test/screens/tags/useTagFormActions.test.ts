const mockAlert = jest.fn();
const mockConfirmDelete = jest.fn();

jest.mock('@/src/hooks/useAsyncOperation', () => ({
  useAsyncOperation: () => ({
    pending: false,
    run: (operation: () => Promise<void>) => operation(),
  }),
}));
jest.mock('../../../src/hooks/useConfirmDelete', () => ({
  useConfirmDelete: () => mockConfirmDelete,
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useTagFormActions } from '../../../src/screens/tags/useTagFormActions';
import type { TagFormState } from '../../../src/screens/tags/useTagFormState';
import type { TagService } from '../../../src/services/storymanagement/TagService';

const createState = (overrides: Partial<TagFormState> = {}): TagFormState =>
  ({
    tagId: undefined,
    name: 'Important',
    setName: jest.fn(),
    color: '#ff0000',
    setColor: jest.fn(),
    isFavorite: false,
    setIsFavorite: jest.fn(),
    extraNotes: null,
    setExtraNotes: jest.fn(),
    loading: false,
    loadError: null,
    isEditing: false,
    ...overrides,
  }) as TagFormState;

const tagService = {
  createTag: jest.fn(),
  updateTag: jest.fn(),
  deleteTag: jest.fn(),
} as unknown as TagService;
const navigation = {
  goBack: jest.fn(),
};

const renderActions = (state = createState()) =>
  renderHook(() =>
    useTagFormActions({
      state,
      tagServiceRef: { current: tagService },
      navigation: navigation as never,
      storyId: 'story-1',
      userId: 'user-1',
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  (tagService.createTag as jest.Mock).mockResolvedValue({ id: 'tag-1' });
  (tagService.updateTag as jest.Mock).mockResolvedValue(undefined);
  (tagService.deleteTag as jest.Mock).mockResolvedValue(undefined);
});

it('rejects an unnamed tag before persistence', async () => {
  const view = await renderActions(createState({ name: '  ' }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'tag_name_required');
  expect(tagService.createTag).not.toHaveBeenCalled();
});

it('creates a tag, shows success and navigates back', async () => {
  const view = await renderActions();

  await act(async () => view.result.current.handleSave());

  expect(tagService.createTag).toHaveBeenCalledWith('user-1', {
    name: 'Important',
    color: '#ff0000',
    isFavorite: false,
    extraNotes: null,
    storyId: 'story-1',
  });
  expect(mockAlert).toHaveBeenCalledWith('success', 'tag_created_successfully');
  expect(navigation.goBack).toHaveBeenCalled();
});

it('updates an existing tag and navigates back', async () => {
  const view = await renderActions(
    createState({ tagId: 'tag-1', isEditing: true, isFavorite: true }),
  );

  await act(async () => view.result.current.handleSave());

  expect(tagService.updateTag).toHaveBeenCalledWith('user-1', 'tag-1', {
    name: 'Important',
    color: '#ff0000',
    isFavorite: true,
    extraNotes: null,
  });
  expect(mockAlert).toHaveBeenCalledWith('success', 'tag_updated_successfully');
  expect(navigation.goBack).toHaveBeenCalled();
});

it('delegates deletion and completes it with back navigation', async () => {
  const view = await renderActions(createState({ tagId: 'tag-1', isEditing: true }));

  await act(async () => view.result.current.handleDelete());
  const request = mockConfirmDelete.mock.calls[0][0];
  await act(async () => request.onConfirm());

  expect(tagService.deleteTag).toHaveBeenCalledWith('user-1', 'tag-1');
  expect(navigation.goBack).toHaveBeenCalled();
});

it('does not show success after a create failure, then recovers on retry', async () => {
  (tagService.createTag as jest.Mock)
    .mockRejectedValueOnce(new Error('failed'))
    .mockResolvedValueOnce({ id: 'tag-1' });
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});

  const view = await renderActions();
  await act(async () => view.result.current.handleSave());
  expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_tag');
  expect(navigation.goBack).not.toHaveBeenCalled();

  mockAlert.mockClear();
  await act(async () => view.result.current.handleSave());
  expect(mockAlert).toHaveBeenCalledWith('success', 'tag_created_successfully');
  expect(navigation.goBack).toHaveBeenCalled();
  log.mockRestore();
});
