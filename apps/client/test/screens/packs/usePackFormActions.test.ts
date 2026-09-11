const mockAlert = jest.fn();
const mockShowNotification = jest.fn();

jest.mock('@/src/hooks/useAsyncOperation', () => ({
  useAsyncOperation: () => ({
    pending: false,
    run: (operation: () => Promise<void>) => operation(),
  }),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('../../../src/state/notificationStore', () => ({
  useNotificationStore: (
    selector: (state: { showNotification: typeof mockShowNotification }) => unknown,
  ) => selector({ showNotification: mockShowNotification }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { act, renderHook } from '@testing-library/react-native';
import { usePackFormActions } from '../../../src/screens/packs/usePackFormActions';
import type { PackFormState } from '../../../src/screens/packs/usePackFormState';
import type { PackService } from '../../../src/services/storymanagement/PackService';

const createState = (overrides: Partial<PackFormState> = {}): PackFormState =>
  ({
    initialPackId: undefined,
    sourceStoryId: 'story-1',
    setSourceStoryId: jest.fn(),
    name: 'Starter pack',
    setName: jest.fn(),
    description: 'Notes',
    setDescription: jest.fn(),
    language: 'en',
    setLanguage: jest.fn(),
    authorName: 'Author',
    setAuthorName: jest.fn(),
    selection: {
      customAttributes: false,
      suggestions: false,
      suggestionsIncludeUsed: false,
      stats: false,
      tags: true,
    },
    setSelection: jest.fn(),
    chooseStory: jest.fn(),
    toggle: jest.fn(),
    nothingSelected: false,
    loading: false,
    isEditing: false,
    ...overrides,
  }) as PackFormState;

const packService = {
  createPack: jest.fn(),
  reextractPack: jest.fn(),
  updatePackDetails: jest.fn(),
} as unknown as PackService;

const navigation = {
  goBack: jest.fn(),
};

const renderActions = (state = createState()) =>
  renderHook(() =>
    usePackFormActions({
      state,
      packServiceRef: { current: packService },
      navigation,
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  (packService.createPack as jest.Mock).mockResolvedValue('pack-1');
  (packService.reextractPack as jest.Mock).mockResolvedValue(undefined);
  (packService.updatePackDetails as jest.Mock).mockResolvedValue(undefined);
});

it('rejects a pack without a source story before persistence', async () => {
  const view = await renderActions(createState({ sourceStoryId: null }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'packs_source_required');
  expect(packService.createPack).not.toHaveBeenCalled();
});

it('rejects a pack without a name before persistence', async () => {
  const view = await renderActions(createState({ name: '  ' }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'packs_name_required');
  expect(packService.createPack).not.toHaveBeenCalled();
});

it('rejects a pack that selects nothing before persistence', async () => {
  const view = await renderActions(createState({ nothingSelected: true }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'packs_selection_required');
  expect(packService.createPack).not.toHaveBeenCalled();
});

it('coordinates create persistence and back navigation', async () => {
  const state = createState();
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(packService.createPack).toHaveBeenCalledWith({
    sourceStoryId: 'story-1',
    name: 'Starter pack',
    description: 'Notes',
    language: 'en',
    authorName: 'Author',
    selection: state.selection,
  });
  expect(navigation.goBack).toHaveBeenCalled();
});

it('reextracts and updates details when editing', async () => {
  const state = createState({
    initialPackId: 'pack-1',
    isEditing: true,
    name: ' Updated ',
    description: '  ',
    language: ' pt ',
    authorName: '',
  });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(packService.reextractPack).toHaveBeenCalledWith('pack-1', state.selection);
  expect(packService.updatePackDetails).toHaveBeenCalledWith('pack-1', {
    name: 'Updated',
    description: null,
    language: 'pt',
    authorName: null,
  });
  expect(packService.createPack).not.toHaveBeenCalled();
  expect(navigation.goBack).toHaveBeenCalled();
});

it('does not navigate after a save failure', async () => {
  (packService.createPack as jest.Mock).mockRejectedValue(new Error('write failed'));
  const view = await renderActions(createState());

  await act(async () => view.result.current.handleSave());

  expect(mockShowNotification).toHaveBeenCalledWith('packs_save_failed', 'error');
  expect(navigation.goBack).not.toHaveBeenCalled();
});
