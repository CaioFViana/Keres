import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockGoBack = jest.fn();
const mockDrawerNavigate = jest.fn();
const mockDrawer = { navigate: mockDrawerNavigate };
const mockNavigation = { goBack: mockGoBack, getParent: () => mockDrawer };
const mockRoute = { params: { type: 'character_role', value: 'Healer' } };
const mockGetSuggestionUsages = jest.fn();
const mockGetStoredSuggestions = jest.fn();
const mockRenameSuggestionValue = jest.fn();
const mockDeleteSuggestion = jest.fn();
const mockNavigateToEntityDetail = jest.fn();
const mockAlert = jest.fn();
const mockLabel = (entity: string, plural?: boolean) => (plural ? `${entity}s` : entity);
const mockSelectedStoryId: { current: string | undefined } = { current: 'story-1' };
const mockCanEdit: { current: boolean } = { current: true };
const mockHeaderConfig: {
  current: { actions: { onPress: () => void; visible?: boolean }[] } | null;
} = { current: null };
const mockDb = {};
const mockI18n = { t: (key: string) => key };

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => mockNavigation,
    useRoute: () => mockRoute,
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('@/src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (config: unknown) => {
    mockHeaderConfig.current = config as never;
  },
}));
jest.mock('@/src/components/layout/ResponsiveModal/ResponsiveModal', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => {
    if (!visible) return null;
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.View, { testID: 'rename-modal' }, children);
  },
}));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit.current }),
}));
jest.mock('../../../src/services/storymanagement/SuggestionService', () => {
  const types = jest.requireActual('../../../src/services/storymanagement/suggestionTypes');
  return {
    __esModule: true,
    isNamedListType: types.isNamedListType,
    createSuggestionService: () => ({
      getSuggestionUsages: mockGetSuggestionUsages,
      getStoredSuggestions: mockGetStoredSuggestions,
      renameSuggestionValue: mockRenameSuggestionValue,
      deleteSuggestion: mockDeleteSuggestion,
    }),
  };
});
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector: (state: unknown) => unknown) =>
    selector({ selectedStory: { id: mockSelectedStoryId.current } }),
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
      primary: '#00f',
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
jest.mock('../../../src/utils/entityNavigation', () => ({
  __esModule: true,
  navigateToEntityDetail: (...args: unknown[]) => mockNavigateToEntityDetail(...args),
}));
jest.mock('../../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({ label: mockLabel }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => mockI18n,
}));

import SuggestionUsageScreen from '../../../src/screens/suggestions/SuggestionUsageScreen';

const usages = [
  { entityType: 'Character', id: 'char-1', title: 'Aria', snippet: 'role: Healer' },
  { entityType: 'Item', id: 'item-1', title: 'Staff', snippet: 'Healer staff' },
];

describe('SuggestionUsageScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockHeaderConfig.current = null;
    mockSelectedStoryId.current = 'story-1';
    mockCanEdit.current = true;
    mockRoute.params = { type: 'character_role', value: 'Healer' };
    mockGetSuggestionUsages.mockResolvedValue(usages);
    mockGetStoredSuggestions.mockResolvedValue([{ id: 'stored-1', value: 'Healer' }]);
    mockRenameSuggestionValue.mockResolvedValue({ merged: false, updatedUsages: 2 });
    mockDeleteSuggestion.mockResolvedValue({});
  });

  it('loads usages grouped by entity type', async () => {
    const view = await render(<SuggestionUsageScreen />);

    expect(view.getByText('Healer')).toBeTruthy();
    await waitFor(() => expect(view.getByText('Aria')).toBeTruthy());
    expect(mockGetSuggestionUsages).toHaveBeenCalledWith('character_role', 'story-1', 'Healer');
    expect(view.getByText('Characters (1)')).toBeTruthy();
    expect(view.getByText('Items (1)')).toBeTruthy();
    expect(view.getByText('Staff')).toBeTruthy();
  });

  it('shows the empty state without usages', async () => {
    mockGetSuggestionUsages.mockResolvedValue([]);
    const view = await render(<SuggestionUsageScreen />);

    await waitFor(() => expect(view.getByText('suggestion_no_usages')).toBeTruthy());
  });

  it('renames the value and its usages, then goes back', async () => {
    const view = await render(<SuggestionUsageScreen />);
    await waitFor(() => expect(view.getByText('Aria')).toBeTruthy());

    expect(mockHeaderConfig.current?.actions[0].visible).toBe(true);
    await act(async () => {
      mockHeaderConfig.current?.actions[0].onPress();
    });
    await waitFor(() => expect(view.getByTestId('rename-modal')).toBeTruthy());

    await fireEvent.changeText(view.getByDisplayValue('Healer'), 'Cleric');
    expect(view.queryByText('suggestion_merge_warning')).toBeNull();
    await fireEvent.press(view.getByText('suggestion_rename_usages'));
    expect(view.getByText('suggestion_rename_usages_warning')).toBeTruthy();
    await fireEvent.press(view.getByText('save'));

    await waitFor(() =>
      expect(mockRenameSuggestionValue).toHaveBeenCalledWith(
        'user-1',
        'story-1',
        'character_role',
        'Healer',
        'Cleric',
        true,
      ),
    );
    expect(mockAlert).toHaveBeenCalledWith('success', 'suggestion_rename_success');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('warns when renaming onto an existing stored value', async () => {
    mockGetStoredSuggestions.mockResolvedValue([
      { id: 'stored-1', value: 'Healer' },
      { id: 'stored-2', value: 'Cleric' },
    ]);
    mockRenameSuggestionValue.mockResolvedValue({ merged: true, updatedUsages: 2 });
    const view = await render(<SuggestionUsageScreen />);
    await waitFor(() => expect(view.getByText('Aria')).toBeTruthy());

    await act(async () => {
      mockHeaderConfig.current?.actions[0].onPress();
    });
    await waitFor(() => expect(view.getByTestId('rename-modal')).toBeTruthy());
    await fireEvent.changeText(view.getByDisplayValue('Healer'), 'Cleric');

    expect(view.getByText('suggestion_merge_warning')).toBeTruthy();
  });

  it('reports rename failures without leaving', async () => {
    mockRenameSuggestionValue.mockRejectedValue(new Error('nope'));
    const view = await render(<SuggestionUsageScreen />);
    await waitFor(() => expect(view.getByText('Aria')).toBeTruthy());

    await act(async () => {
      mockHeaderConfig.current?.actions[0].onPress();
    });
    await waitFor(() => expect(view.getByTestId('rename-modal')).toBeTruthy());
    await fireEvent.press(view.getByText('save'));

    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', 'nope'));
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('removes the saved value after confirmation', async () => {
    const view = await render(<SuggestionUsageScreen />);
    await waitFor(() => expect(view.getByText('Aria')).toBeTruthy());

    expect(mockHeaderConfig.current?.actions[1].visible).toBe(true);
    await act(async () => {
      mockHeaderConfig.current?.actions[1].onPress();
    });
    expect(mockAlert).toHaveBeenCalled();
    const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    const confirm = buttons.find((button) => button.text === 'remove');
    await confirm?.onPress?.();

    await waitFor(() => expect(mockDeleteSuggestion).toHaveBeenCalledWith('user-1', 'stored-1'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('hides the remove action for values that were never saved', async () => {
    mockGetStoredSuggestions.mockResolvedValue([]);
    const view = await render(<SuggestionUsageScreen />);
    await waitFor(() => expect(view.getByText('Aria')).toBeTruthy());

    expect(mockHeaderConfig.current?.actions[1].visible).toBe(false);
  });

  it('opens usages in their detail screens with a way back', async () => {
    mockGetSuggestionUsages.mockResolvedValue([
      ...usages,
      {
        entityType: 'CharacterRelation',
        id: 'rel-1',
        title: 'Bond',
        snippet: 'bond snippet',
        characterIds: ['char-1'],
        characterNames: ['Beto'],
      },
    ]);
    const view = await render(<SuggestionUsageScreen />);
    await waitFor(() => expect(view.getByText('Bond')).toBeTruthy());

    await fireEvent.press(view.getByText('Beto'));
    expect(mockNavigateToEntityDetail).toHaveBeenCalledWith(
      mockDrawer,
      'Character',
      'char-1',
      expect.objectContaining({ onReturn: expect.any(Function) }),
    );
    const onReturn = mockNavigateToEntityDetail.mock.calls[0][3].onReturn as () => void;
    onReturn();
    expect(mockDrawerNavigate).toHaveBeenCalledWith('CustomizationStack', {
      screen: 'SuggestionUsage',
      params: { type: 'character_role', value: 'Healer' },
    });
  });

  it('marks named-list values as catalog-only', async () => {
    mockRoute.params = { type: 'list_01ARZ3NDEKTSV4RRFFQ69G5FAA_herbs', value: 'Sage' };
    const view = await render(<SuggestionUsageScreen />);

    await waitFor(() => expect(view.getByText('Sage')).toBeTruthy());
    expect(view.getByText('suggestion_catalog_only')).toBeTruthy();
  });
});
