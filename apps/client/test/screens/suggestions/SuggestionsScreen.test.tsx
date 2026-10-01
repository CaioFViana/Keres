import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
  type RenderResult,
} from '@testing-library/react-native';
import { AttributeType } from '@keres/shared';
import React from 'react';

const mockNavigate = jest.fn();
const mockNavigation = { navigate: mockNavigate };
const mockListNamedLists = jest.fn();
const mockGetStoredSuggestions = jest.fn();
const mockGetSuggestionUsageCounts = jest.fn();
const mockCreateSuggestion = jest.fn();
const mockCreateNamedList = jest.fn();
const mockRenameNamedList = jest.fn();
const mockCopyStoredValues = jest.fn();
const mockDeleteNamedList = jest.fn();
const mockGetFieldsByStoryAndEntityType = jest.fn();
const mockAlert = jest.fn();
const mockLabel = (entity: string, plural?: boolean) => (plural ? `${entity}s` : entity);
const mockSelectedStory = { id: 'story-1' };
const mockCanEdit: { current: boolean } = { current: true };
const mockCompact: { current: boolean } = { current: true };
const mockHeaderConfig: {
  current: { actions: { onPress: () => void; visible?: boolean }[] } | null;
} = { current: null };
const mockDb = {};
const mockI18n = { t: (key: string) => key };
const mockUseScreenTour = jest.fn();

jest.mock('../../../src/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
}));

const HERBS = 'list_01ARZ3NDEKTSV4RRFFQ69G5FAA_herbs';
const SPICES = 'list_01ARZ3NDEKTSV4RRFFQ69G5FAB_spices';

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => mockNavigation,
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('@keres/shared/metadata/entityFields', () => ({
  __esModule: true,
  entityFieldMetadata: {},
}));
jest.mock('@keres/shared/entities/WorldRule', () => ({
  __esModule: true,
  WORLD_PIECE_SECTIONS: [],
}));
jest.mock('@/src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (config: unknown) => {
    mockHeaderConfig.current = config as never;
  },
}));
jest.mock('@/src/components/layout/ScreenSection/ScreenSection', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title }: { title: string }) => <Text testID={`section-${title}`}>{title}</Text>,
  };
});
jest.mock('@/src/components/layout/ResponsiveModal/ResponsiveModal', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => {
    if (!visible) return null;
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.View, { testID: 'modal-visible' }, children);
  },
}));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useResponsiveLayout', () => ({
  __esModule: true,
  useResponsiveLayout: () => ({ isCompact: mockCompact.current }),
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit.current }),
}));
jest.mock('../../../src/services/storymanagement/SuggestionService', () => {
  const types = jest.requireActual('../../../src/services/storymanagement/suggestionTypes');
  return {
    __esModule: true,
    ...types,
    createSuggestionService: () => ({
      listNamedLists: mockListNamedLists,
      getStoredSuggestions: mockGetStoredSuggestions,
      getSuggestionUsageCounts: mockGetSuggestionUsageCounts,
      createSuggestion: mockCreateSuggestion,
      createNamedList: mockCreateNamedList,
      renameNamedList: mockRenameNamedList,
      copyStoredValues: mockCopyStoredValues,
      deleteNamedList: mockDeleteNamedList,
    }),
  };
});
jest.mock('../../../src/services/storymanagement/StorySchemaFieldService', () => ({
  __esModule: true,
  createStorySchemaFieldService: () => ({
    getFieldsByStoryAndEntityType: mockGetFieldsByStoryAndEntityType,
  }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockSelectedStory }),
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: 'user-1' }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      primaryContainer: '#ccf',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('../../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({ label: mockLabel }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => mockI18n,
}));

import SuggestionsScreen from '../../../src/screens/suggestions/SuggestionsScreen';

const namedLists = [
  { type: HERBS, name: 'Herbs' },
  { type: SPICES, name: 'Spices' },
];

function modal(view: RenderResult) {
  return within(view.getByTestId('modal-visible'));
}

describe('SuggestionsScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockHeaderConfig.current = null;
    mockCanEdit.current = true;
    mockCompact.current = true;
    mockListNamedLists.mockResolvedValue(namedLists);
    mockGetFieldsByStoryAndEntityType.mockResolvedValue([]);
    mockGetStoredSuggestions.mockImplementation(async (type: string) =>
      type === HERBS ? [{ id: 's-1', value: 'Sage' }] : [],
    );
    mockGetSuggestionUsageCounts.mockImplementation(async (type: string) =>
      type === HERBS
        ? [
            ['Sage', 3],
            ['Thyme', 1],
          ]
        : [],
    );
    mockCreateSuggestion.mockResolvedValue({});
    mockCreateNamedList.mockResolvedValue({ type: 'list_new', name: 'Roots' });
    mockRenameNamedList.mockResolvedValue({});
    mockCopyStoredValues.mockResolvedValue({ copied: 1, skipped: 0 });
    mockDeleteNamedList.mockResolvedValue({});
  });

  it('requests its guided tour', async () => {
    await render(<SuggestionsScreen />);

    expect(mockUseScreenTour).toHaveBeenCalledWith('Suggestions');
  });

  it('loads named lists with their stored and story values', async () => {
    const view = await render(<SuggestionsScreen />);

    await waitFor(() => expect(mockListNamedLists).toHaveBeenCalledWith('story-1'));
    expect(view.getByText('standard_suggestions_title')).toBeTruthy();
    expect(view.getByText('suggestion_named_list · Herbs')).toBeTruthy();
    expect(view.getByText('suggestion_named_list · Spices')).toBeTruthy();

    await waitFor(() => expect(view.getByText('Sage')).toBeTruthy());
    expect(view.getByTestId('section-suggestion_saved_values')).toBeTruthy();
    expect(view.getByTestId('section-suggestion_values_in_story')).toBeTruthy();
    expect(view.getByText('Thyme')).toBeTruthy();
    expect(view.getByText(/suggestion_key/)).toBeTruthy();
  });

  it('switches lists and navigates to a value usage', async () => {
    const view = await render(<SuggestionsScreen />);
    await waitFor(() => expect(view.getByText('Sage')).toBeTruthy());

    await fireEvent.press(view.getByText('suggestion_named_list · Spices'));
    await waitFor(() => expect(view.getByText('no_suggestions_available')).toBeTruthy());
    expect(mockGetStoredSuggestions).toHaveBeenCalledWith(SPICES, 'story-1');

    await fireEvent.press(view.getByText('suggestion_named_list · Herbs'));
    await waitFor(() => expect(view.getByText('Sage')).toBeTruthy());
    await fireEvent.press(view.getByText('Sage'));
    expect(mockNavigate).toHaveBeenCalledWith('SuggestionUsage', { type: HERBS, value: 'Sage' });
    await fireEvent.press(view.getByText('Thyme'));
    expect(mockNavigate).toHaveBeenCalledWith('SuggestionUsage', { type: HERBS, value: 'Thyme' });
  });

  it('adds a value to the selected list and reports failures', async () => {
    const view = await render(<SuggestionsScreen />);
    await waitFor(() => expect(view.getByText('Sage')).toBeTruthy());

    await fireEvent.changeText(view.getByPlaceholderText('suggestion_value_placeholder'), 'Mage');
    await fireEvent.press(view.getByText('add'));
    await waitFor(() =>
      expect(mockCreateSuggestion).toHaveBeenCalledWith('user-1', HERBS, 'Mage', 'story-1'),
    );

    mockCreateSuggestion.mockRejectedValueOnce(new Error('duplicate'));
    await fireEvent.changeText(view.getByPlaceholderText('suggestion_value_placeholder'), 'Mage');
    await fireEvent.press(view.getByText('add'));
    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', 'duplicate'));
  });

  it('creates a named list and selects it', async () => {
    mockListNamedLists
      .mockResolvedValueOnce(namedLists)
      .mockResolvedValue([...namedLists, { type: 'list_new', name: 'Roots' }]);
    const view = await render(<SuggestionsScreen />);
    await waitFor(() => expect(view.getByText('Sage')).toBeTruthy());

    await act(async () => {
      mockHeaderConfig.current?.actions[0].onPress();
    });
    const scope = modal(view);
    expect(scope.getByText('suggestion_new_list')).toBeTruthy();
    await fireEvent.changeText(
      scope.getByPlaceholderText('suggestion_list_name_placeholder'),
      'Roots',
    );
    await fireEvent.press(scope.getByText('add'));

    await waitFor(() =>
      expect(mockCreateNamedList).toHaveBeenCalledWith('user-1', 'story-1', 'Roots'),
    );
    await waitFor(() => expect(view.getByText('suggestion_named_list · Roots')).toBeTruthy());
  });

  it('renames the selected named list', async () => {
    const view = await render(<SuggestionsScreen />);
    await waitFor(() => expect(view.getByText('Sage')).toBeTruthy());

    expect(mockHeaderConfig.current?.actions[2].visible).toBe(true);
    await act(async () => {
      mockHeaderConfig.current?.actions[2].onPress();
    });
    const scope = modal(view);
    await fireEvent.changeText(scope.getByDisplayValue('Herbs'), 'Herbarium');
    await fireEvent.press(scope.getByText('save'));

    await waitFor(() =>
      expect(mockRenameNamedList).toHaveBeenCalledWith('user-1', 'story-1', HERBS, 'Herbarium'),
    );
  });

  it('copies stored values to other lists', async () => {
    const view = await render(<SuggestionsScreen />);
    await waitFor(() => expect(view.getByText('Sage')).toBeTruthy());

    expect(mockHeaderConfig.current?.actions[1].visible).toBe(true);
    await act(async () => {
      mockHeaderConfig.current?.actions[1].onPress();
    });
    const scope = modal(view);
    expect(scope.getByText('suggestion_copy_to')).toBeTruthy();
    await fireEvent.press(scope.getByText('suggestion_named_list · Spices'));
    await fireEvent.press(scope.getByText('suggestion_copy_confirm'));

    await waitFor(() =>
      expect(mockCopyStoredValues).toHaveBeenCalledWith('user-1', 'story-1', HERBS, [SPICES]),
    );
    expect(mockAlert).toHaveBeenCalledWith('success', 'suggestion_copy_result');
  });

  it('deletes a named list after confirmation', async () => {
    const view = await render(<SuggestionsScreen />);
    await waitFor(() => expect(view.getByText('Sage')).toBeTruthy());

    expect(mockHeaderConfig.current?.actions[3].visible).toBe(true);
    await act(async () => {
      mockHeaderConfig.current?.actions[3].onPress();
    });
    expect(mockAlert).toHaveBeenCalled();
    const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    const confirm = buttons.find((button) => button.text === 'delete');
    await act(async () => {
      await confirm?.onPress?.();
    });

    await waitFor(() =>
      expect(mockDeleteNamedList).toHaveBeenCalledWith('user-1', 'story-1', HERBS),
    );
  });

  it('lists custom suggestion fields as groups', async () => {
    mockGetFieldsByStoryAndEntityType.mockImplementation(
      async (_storyId: string, entity: string) =>
        entity === 'Character'
          ? [{ id: 'field-1', key: 'skill', name: 'Skill', type: AttributeType.SUGGESTION }]
          : [],
    );
    const view = await render(<SuggestionsScreen />);

    await waitFor(() => expect(view.getByText(/Skill/)).toBeTruthy());
    await fireEvent.press(view.getByText(/Skill/));
    await waitFor(() =>
      expect(mockGetStoredSuggestions).toHaveBeenCalledWith('custom:field-1', 'story-1'),
    );
    expect(mockHeaderConfig.current?.actions[2].visible).toBe(false);
    expect(mockHeaderConfig.current?.actions[3].visible).toBe(false);
  });

  it('renders the group column on wide layouts', async () => {
    mockCompact.current = false;
    const view = await render(<SuggestionsScreen />);

    await waitFor(() => expect(view.getByText('Sage')).toBeTruthy());
    expect(view.getByText('suggestion_named_list · Herbs')).toBeTruthy();
    expect(view.getByText('suggestion_named_list · Spices')).toBeTruthy();
  });
});
