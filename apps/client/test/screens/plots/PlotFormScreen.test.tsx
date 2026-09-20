import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import PlotFormScreen from '../../../src/screens/plots/PlotFormScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockHandleSave = jest.fn();
const mockHandleDelete = jest.fn();
let mockRouteParams: any = {};
let mockStory: any = null;
let mockFormState: any = null;
let mockResources: any = null;
let mockSaving = false;
let mockDeleting = false;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('../../../src/theme', () => ({
  useTheme: () => ({
    isDarkMode: false,
    colors: {
      background: '#fff',
      surface: '#fff',
      card: '#fff',
      text: '#111',
      textSecondary: '#555',
      border: '#ddd',
      primary: '#00f',
      primaryContainer: '#ddf',
      onPrimaryContainer: '#001',
      secondary: '#0a0',
      accent: '#a0a',
      error: '#f00',
    },
  }),
}));

jest.mock('../../../src/components/features/plots/PlotSceneManager/PlotSceneManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ relations }: any) => (
      <Text testID="plot-scene-manager">{`relations:${relations.length}`}</Text>
    ),
  };
});

jest.mock('../../../src/state/storyStore', () => ({
  useStoryStore: (selector?: (s: any) => any) => {
    const state = {
      selectedStory: mockStory,
      setSelectedStory: jest.fn(),
      activeArcId: null,
      setActiveArcId: jest.fn(),
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('../../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: (selector?: (s: any) => any) => {
    const state = { userId: 'user-1', exportFormat: 'svg' };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('../../../src/screens/plots/usePlotFormResources', () => ({
  usePlotFormResources: () => mockResources,
}));

jest.mock('../../../src/screens/plots/usePlotFormState', () => ({
  usePlotFormState: () => mockFormState,
}));

jest.mock('../../../src/screens/plots/usePlotFormActions', () => ({
  usePlotFormActions: () => ({
    deleting: mockDeleting,
    handleDelete: mockHandleDelete,
    handleSave: mockHandleSave,
    handleSavePlotScene: jest.fn(),
    handleDeletePlotScene: jest.fn(),
    saving: mockSaving,
  }),
}));

jest.mock('../../../src/hooks/useScreenHeader', () => ({ useScreenHeader: jest.fn() }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: jest.fn() }));
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 32,
}));

function formState(overrides: any = {}) {
  return {
    name: '',
    setName: jest.fn(),
    details: '',
    setDetails: jest.fn(),
    loading: false,
    isEditing: false,
    isDirty: false,
    resetForm: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('PlotFormScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRouteParams = {};
    mockStory = { id: 'story-1', type: 'linear', title: 'Story' };
    mockFormState = formState();
    mockResources = {
      plotServiceRef: { current: {} },
      plotSceneServiceRef: { current: {} },
      scenes: [],
      relationsOf: () => [],
      chapterNameOf: () => undefined,
      reloadPlotData: jest.fn(),
    };
    mockSaving = false;
    mockDeleting = false;
  });

  it('shows loading state', async () => {
    mockFormState = formState({ loading: true });
    const view = await render(<PlotFormScreen />);
    expect(view.toJSON()).toBeTruthy();
  });

  it('creates a plot without the scene manager', async () => {
    const setName = jest.fn();
    const setDetails = jest.fn();
    mockFormState = formState({ setName, setDetails });
    const view = await render(<PlotFormScreen />);
    expect(view.getAllByText('create_plot').length).toBeGreaterThan(0);
    expect(view.queryByTestId('plot-scene-manager')).toBeNull();
    await fireEvent.changeText(view.getByPlaceholderText('plot_name_placeholder'), 'Rebellion');
    expect(setName).toHaveBeenCalledWith('Rebellion');
    await fireEvent.changeText(view.getByPlaceholderText('plot_details_placeholder'), 'Uprising');
    expect(setDetails).toHaveBeenCalledWith('Uprising');
    await fireEvent.press(view.getAllByText('create_plot')[1]);
    expect(mockHandleSave).toHaveBeenCalledTimes(1);
  });

  it('edits a plot with scenes and deletes', async () => {
    mockRouteParams = { plotId: 'plot-1' };
    mockFormState = formState({ name: 'Rebellion', details: 'Uprising', isEditing: true });
    mockResources = {
      ...mockResources,
      relationsOf: () => [{ id: 'r1' }, { id: 'r2' }],
    };
    const view = await render(<PlotFormScreen />);
    expect(view.getAllByText('edit_plot').length).toBeGreaterThan(0);
    expect(view.getByTestId('plot-scene-manager').props.children).toBe('relations:2');
    await fireEvent.press(view.getByText('save_changes'));
    expect(mockHandleSave).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByText('delete_plot_title'));
    expect(mockHandleDelete).toHaveBeenCalledTimes(1);
  });
});
