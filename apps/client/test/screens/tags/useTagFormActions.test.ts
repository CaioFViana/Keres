const mockAlert = jest.fn();
const mockConfirmDelete = jest.fn();

// Only the shared hook imports these, and it loads them even for a form with no custom attributes.
jest.mock('@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields', () => ({
  validateRequiredCustomAttributes: () => null,
}));
jest.mock('../../../src/services/storymanagement/AttributeValueService', () => ({
  createAttributeValueService: () => ({ saveValuesForEntity: jest.fn() }),
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
    clearFormDraft: jest.fn().mockResolvedValue(undefined),
    draftRestored: false,
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

type RenderOptions = {
  userId?: string | null;
  storyId?: string;
  service?: TagService | null;
};

const renderActions = (state = createState(), options: RenderOptions = {}) =>
  renderHook(() =>
    useTagFormActions({
      state,
      tagServiceRef: { current: 'service' in options ? options.service! : tagService },
      navigation: navigation as never,
      storyId: 'storyId' in options ? options.storyId : 'story-1',
      userId: 'userId' in options ? options.userId : 'user-1',
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
  const state = createState();
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(tagService.createTag).toHaveBeenCalledWith('user-1', {
    name: 'Important',
    color: '#ff0000',
    isFavorite: false,
    extraNotes: null,
    storyId: 'story-1',
  });
  expect(mockAlert).toHaveBeenCalledWith('success', 'tag_created_successfully');
  expect(state.clearFormDraft).toHaveBeenCalledTimes(1);
  expect(navigation.goBack).toHaveBeenCalled();
});

it('updates an existing tag and navigates back', async () => {
  const state = createState({ tagId: 'tag-1', isEditing: true, isFavorite: true });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(tagService.updateTag).toHaveBeenCalledWith('user-1', 'tag-1', {
    name: 'Important',
    color: '#ff0000',
    isFavorite: true,
    extraNotes: null,
  });
  expect(mockAlert).toHaveBeenCalledWith('success', 'tag_updated_successfully');
  expect(state.clearFormDraft).toHaveBeenCalledTimes(1);
  expect(navigation.goBack).toHaveBeenCalled();
});

it('delegates deletion and completes it with back navigation', async () => {
  const state = createState({ tagId: 'tag-1', isEditing: true });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleDelete());
  const request = mockConfirmDelete.mock.calls[0][0];
  await act(async () => request.onConfirm());

  expect(tagService.deleteTag).toHaveBeenCalledWith('user-1', 'tag-1');
  expect(state.clearFormDraft).toHaveBeenCalledTimes(1);
  expect(navigation.goBack).toHaveBeenCalled();
});

it('does not show success after a create failure, then recovers on retry', async () => {
  (tagService.createTag as jest.Mock)
    .mockRejectedValueOnce(new Error('failed'))
    .mockResolvedValueOnce({ id: 'tag-1' });
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});

  const state = createState();
  const view = await renderActions(state);
  await act(async () => view.result.current.handleSave());
  expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_tag');
  expect(navigation.goBack).not.toHaveBeenCalled();
  expect(state.clearFormDraft).not.toHaveBeenCalled();

  mockAlert.mockClear();
  await act(async () => view.result.current.handleSave());
  expect(mockAlert).toHaveBeenCalledWith('success', 'tag_created_successfully');
  expect(state.clearFormDraft).toHaveBeenCalledTimes(1);
  expect(navigation.goBack).toHaveBeenCalled();
  log.mockRestore();
});

describe('what stops a save before it reaches the service', () => {
  it.each([
    ['no user', { userId: null }, 'user_not_identified'],
    ['no story', { storyId: undefined }, 'no_story_selected'],
    ['no service', { service: null }, 'failed_to_save_tag'],
  ])('says so and writes nothing with %s', async (_label, options, message) => {
    const state = createState();
    const view = await renderActions(state, options);

    await act(async () => view.result.current.handleSave());

    expect(mockAlert).toHaveBeenCalledWith('error', message);
    expect(tagService.createTag).not.toHaveBeenCalled();
    expect(state.clearFormDraft).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});

it('keeps the form and the draft when an update fails', async () => {
  (tagService.updateTag as jest.Mock).mockRejectedValueOnce(new Error('failed'));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const state = createState({ tagId: 'tag-1', isEditing: true });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledTimes(1);
  expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_tag');
  expect(state.clearFormDraft).not.toHaveBeenCalled();
  expect(navigation.goBack).not.toHaveBeenCalled();
  log.mockRestore();
});

describe('deleting', () => {
  it('says the user is unknown and asks for no confirmation', async () => {
    const view = await renderActions(createState({ tagId: 'tag-1', isEditing: true }), {
      userId: null,
    });

    await act(async () => view.result.current.handleDelete());

    expect(mockAlert).toHaveBeenCalledWith('error', 'user_not_identified');
    expect(mockConfirmDelete).not.toHaveBeenCalled();
  });

  it.each([
    ['a tag that was never saved', createState(), {}],
    ['no service', createState({ tagId: 'tag-1', isEditing: true }), { service: null }],
  ])('does nothing for %s', async (_label, state, options) => {
    const view = await renderActions(state, options);

    await act(async () => view.result.current.handleDelete());

    expect(mockConfirmDelete).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('leaves the draft and the screen alone when the delete fails', async () => {
    (tagService.deleteTag as jest.Mock).mockRejectedValueOnce(new Error('failed'));
    const state = createState({ tagId: 'tag-1', isEditing: true });
    const view = await renderActions(state);

    await act(async () => view.result.current.handleDelete());
    const request = mockConfirmDelete.mock.calls[0][0];
    await expect(request.onConfirm()).rejects.toThrow('failed');

    expect(state.clearFormDraft).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('passes the texts of the tag to the confirmation', async () => {
    const view = await renderActions(createState({ tagId: 'tag-1', isEditing: true }));

    await act(async () => view.result.current.handleDelete());

    expect(mockConfirmDelete.mock.calls[0][0]).toMatchObject({
      titleKey: 'delete_tag_title',
      messageKey: 'delete_tag_message',
      successKey: 'tag_deleted_successfully',
      failureKey: 'failed_to_delete_tag',
    });
  });
});
