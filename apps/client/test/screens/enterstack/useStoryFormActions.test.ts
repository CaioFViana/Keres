const mockAlert = jest.fn();

jest.mock('@/src/hooks/useAsyncOperation', () => ({
  useAsyncOperation: () => ({
    pending: false,
    run: (operation: () => Promise<void>) => operation(),
  }),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { detail?: string }) =>
      options?.detail ? `${key}:${options.detail}` : key,
  }),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useStoryFormActions } from '../../../src/screens/enterstack/useStoryFormActions';
import type { StoryFormState } from '../../../src/screens/enterstack/useStoryFormState';
import type { PackService } from '../../../src/services/storymanagement/PackService';
import type { StoryService } from '../../../src/services/storymanagement/StoryService';

const createIdentity = (overrides: Record<string, unknown> = {}) =>
  ({
    title: 'Draft',
    setTitle: jest.fn(),
    type: 'linear' as const,
    setType: jest.fn(),
    description: null,
    setDescription: jest.fn(),
    genre: null,
    setGenre: jest.fn(),
    language: null,
    setLanguage: jest.fn(),
    author: null,
    setAuthor: jest.fn(),
    isFavorite: false,
    setIsFavorite: jest.fn(),
    favoriteBehavior: 'individual' as const,
    setFavoriteBehavior: jest.fn(),
    extraNotes: null,
    setExtraNotes: jest.fn(),
    applyStoryIdentity: jest.fn(),
    storyFieldsFormProps: {} as StoryFormState['identity']['storyFieldsFormProps'],
    ...overrides,
  }) as StoryFormState['identity'];

const createState = (overrides: Partial<StoryFormState> = {}): StoryFormState =>
  ({
    initialStoryId: undefined,
    identity: createIdentity(),
    selectedPackIds: [],
    setSelectedPackIds: jest.fn(),
    loading: false,
    error: null,
    setError: jest.fn(),
    isEditing: false,
    ...overrides,
  }) as StoryFormState;

const storyService = {
  createStory: jest.fn(),
  updateStory: jest.fn(),
  deleteStory: jest.fn(),
} as unknown as StoryService;

const packService = {
  findConflicts: jest.fn(),
  createStoryWithPacks: jest.fn(),
} as unknown as PackService;

const navigation = {
  goBack: jest.fn(),
};

const renderActions = (
  state = createState(),
  options: { canEdit?: boolean; canManageStoryPolicy?: boolean; userId?: string | null } = {},
) =>
  renderHook(() =>
    useStoryFormActions({
      state,
      storyServiceRef: { current: storyService },
      packServiceRef: { current: packService },
      navigation: navigation as never,
      userId: options.userId === undefined ? 'user-1' : options.userId,
      canEdit: options.canEdit ?? true,
      canManageStoryPolicy: options.canManageStoryPolicy ?? true,
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  (storyService.createStory as jest.Mock).mockResolvedValue({ id: 'story-1' });
  (storyService.updateStory as jest.Mock).mockResolvedValue(undefined);
  (storyService.deleteStory as jest.Mock).mockResolvedValue(undefined);
  (packService.findConflicts as jest.Mock).mockResolvedValue([]);
  (packService.createStoryWithPacks as jest.Mock).mockResolvedValue('story-1');
});

it('rejects a story without a title before persistence', async () => {
  const state = createState({ identity: createIdentity({ title: '  ' }) });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'title_required');
  expect(storyService.createStory).not.toHaveBeenCalled();
});

it('coordinates persistence, success messaging and back navigation after creation', async () => {
  const state = createState();
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(storyService.createStory).toHaveBeenCalledWith(
    'user-1',
    expect.objectContaining({ title: 'Draft', type: 'linear', autoLinkMentions: true }),
  );
  expect(mockAlert).toHaveBeenCalledWith('success', 'story_created_successfully');
  expect(navigation.goBack).toHaveBeenCalled();
});

it('applies selected packs after conflict checks when creating', async () => {
  const state = createState({ selectedPackIds: ['pack-1', 'pack-2'] });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(packService.findConflicts).toHaveBeenCalledWith(['pack-1', 'pack-2']);
  expect(packService.createStoryWithPacks).toHaveBeenCalledWith(
    'user-1',
    expect.objectContaining({ title: 'Draft' }),
    ['pack-1', 'pack-2'],
  );
  expect(storyService.createStory).not.toHaveBeenCalled();
  expect(mockAlert).toHaveBeenCalledWith('success', 'story_created_successfully');
  expect(navigation.goBack).toHaveBeenCalled();
});

it('stops creation when selected packs conflict', async () => {
  (packService.findConflicts as jest.Mock).mockResolvedValue([{ kind: 'tag', detail: 'Hero' }]);
  const state = createState({ selectedPackIds: ['pack-1'] });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('packs_conflict_title', 'packs_conflict_tag:Hero');
  expect(packService.createStoryWithPacks).not.toHaveBeenCalled();
  expect(navigation.goBack).not.toHaveBeenCalled();
});

it('updates an existing story and navigates back', async () => {
  const state = createState({
    initialStoryId: 'story-1',
    isEditing: true,
    identity: createIdentity({ title: 'Revised' }),
  });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(storyService.updateStory).toHaveBeenCalledWith(
    'user-1',
    'story-1',
    expect.objectContaining({ title: 'Revised', favoriteBehavior: 'individual' }),
  );
  expect(mockAlert).toHaveBeenCalledWith('success', 'story_updated_successfully');
  expect(navigation.goBack).toHaveBeenCalled();
});

it('deletes an existing story after confirmation', async () => {
  const state = createState({ initialStoryId: 'story-1', isEditing: true });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleDelete());
  const buttons = mockAlert.mock.calls[0][2] as Array<{
    text: string;
    onPress?: () => Promise<void>;
  }>;
  const deleteButton = buttons.find((button) => button.text === 'delete');
  await act(async () => {
    await deleteButton?.onPress?.();
  });

  expect(storyService.deleteStory).toHaveBeenCalledWith('story-1');
  expect(mockAlert).toHaveBeenCalledWith('success', 'story_deleted_successfully');
  expect(navigation.goBack).toHaveBeenCalled();
});

it('does not show success after a save failure', async () => {
  (storyService.createStory as jest.Mock).mockRejectedValue(new Error('write failed'));
  const state = createState();
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(state.setError).toHaveBeenCalledWith('failed_to_save_story');
  expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_story');
  expect(navigation.goBack).not.toHaveBeenCalled();
});
