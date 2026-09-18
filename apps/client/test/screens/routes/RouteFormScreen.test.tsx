import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import RouteFormScreen from '../../../src/screens/routes/RouteFormScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockHandleSave = jest.fn();
const mockHandleDelete = jest.fn();
let mockRouteParams: any = {};
let mockStory: any = null;
let mockFormState: any = null;
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

jest.mock('../../../src/screens/routes/useRouteFormResources', () => ({
  useRouteFormResources: () => ({ routeServiceRef: { current: {} } }),
}));

jest.mock('../../../src/screens/routes/useRouteFormState', () => ({
  useRouteFormState: () => mockFormState,
}));

jest.mock('../../../src/screens/routes/useRouteFormActions', () => ({
  useRouteFormActions: () => ({
    deleting: mockDeleting,
    handleDelete: mockHandleDelete,
    handleSave: mockHandleSave,
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
    ...overrides,
  };
}

describe('RouteFormScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRouteParams = {};
    mockStory = { id: 'story-1', type: 'branching', title: 'Story' };
    mockFormState = formState();
    mockSaving = false;
    mockDeleting = false;
  });

  it('shows loading state', async () => {
    mockFormState = formState({ loading: true });
    const view = await render(<RouteFormScreen />);
    expect(view.toJSON()).toBeTruthy();
  });

  it('creates a route', async () => {
    const setName = jest.fn();
    const setDetails = jest.fn();
    mockFormState = formState({ setName, setDetails });
    const view = await render(<RouteFormScreen />);
    expect(view.getAllByText('create_route').length).toBe(2);
    await fireEvent.changeText(view.getByPlaceholderText('route_name_placeholder'), 'North');
    expect(setName).toHaveBeenCalledWith('North');
    await fireEvent.changeText(view.getByPlaceholderText('route_details_placeholder'), 'Cold');
    expect(setDetails).toHaveBeenCalledWith('Cold');
    await fireEvent.press(view.getAllByText('create_route')[1]);
    expect(mockHandleSave).toHaveBeenCalledTimes(1);
  });

  it('edits and deletes a route', async () => {
    mockRouteParams = { routeId: 'route-1' };
    mockFormState = formState({ name: 'North', details: 'Cold', isEditing: true });
    const view = await render(<RouteFormScreen />);
    expect(view.getAllByText('edit_route').length).toBeGreaterThan(0);
    await fireEvent.press(view.getByText('save_changes'));
    expect(mockHandleSave).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByText('delete_route_title'));
    expect(mockHandleDelete).toHaveBeenCalledTimes(1);
  });
});
