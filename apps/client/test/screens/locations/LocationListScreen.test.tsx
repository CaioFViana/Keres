import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockToggleFavorite = jest.fn();
const mockSetAdvancedSearchCriteria = jest.fn();
const mockGetTagsByStoryId = jest.fn();
const mockUseEntityListScreen = jest.fn();
const mockUseScreenTour = jest.fn();
let mockListState = {
  listProps: {},
  items: [] as { id: string; name: string }[],
  isInitialLoading: false,
  error: null as string | null,
  storyId: 'story-1' as string | undefined,
  advancedSearchCriteria: null,
  setAdvancedSearchCriteria: mockSetAdvancedSearchCriteria,
  toggleFavorite: mockToggleFavorite,
};
let mockListProps: {
  data: { id: string; name: string }[];
  renderItem: (info: { item: { id: string; name: string } }) => React.ReactNode;
  filterOptions: { label: string; value: string }[];
  sortOptions: { label: string; value: string }[];
  emptyStateTitle?: string;
  emptyStateMessage?: string;
  emptyStateActions?: { label: string; onPress: () => void }[];
} | null = null;

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      getParent: () => ({ setOptions: jest.fn() }),
    }),
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('../../../src/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
}));
jest.mock('@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList', () => ({
  __esModule: true,
  default: (props: {
    data: { id: string; name: string }[];
    renderItem: (info: { item: { id: string; name: string } }) => React.ReactNode;
    filterOptions: { label: string; value: string }[];
    sortOptions: { label: string; value: string }[];
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    mockListProps = props;
    return react.createElement(
      native.View,
      { testID: 'location-list-stub' },
      props.data.map((item) =>
        react.createElement(react.Fragment, { key: item.id }, props.renderItem({ item })),
      ),
    );
  },
}));
jest.mock('@/src/components/common/feedback/ScreenState/ScreenState', () => ({
  __esModule: true,
  ScreenLoading: ({ message }: { message: string }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'screen-loading' }, message);
  },
  ScreenError: ({ message, onGoBack }: { message: string; onGoBack: () => void }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'screen-error', onPress: onGoBack }, message);
  },
}));
jest.mock('@/src/components/features/list-items/LocationListItem', () => ({
  __esModule: true,
  default: ({
    location,
    onToggleFavorite,
    onViewDetails,
  }: {
    location: { id: string; name: string; isFavorite?: boolean };
    onToggleFavorite: (id: string, isFavorite: boolean) => void;
    onViewDetails: (id: string) => void;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      null,
      react.createElement(
        native.Text,
        {
          testID: `fav-${location.id}`,
          onPress: () => onToggleFavorite(location.id, !location.isFavorite),
        },
        `fav ${location.name}`,
      ),
      react.createElement(
        native.Text,
        { testID: `view-${location.id}`, onPress: () => onViewDetails(location.id) },
        `view ${location.name}`,
      ),
    );
  },
}));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => ({}) }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useEntityListScreen', () => ({
  __esModule: true,
  useEntityListScreen: (...args: unknown[]) => mockUseEntityListScreen(...args),
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: true }),
}));
jest.mock('../../../src/services/storymanagement/TagService', () => ({
  __esModule: true,
  createTagService: () => ({ getTagsByStoryId: mockGetTagsByStoryId }),
}));
jest.mock('../../../src/state/locationStore', () => ({
  __esModule: true,
  useLocationStore: jest.fn(),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { background: '#fff' } }),
}));
jest.mock('../../../src/utils/documentTitle', () => ({
  __esModule: true,
  setDocumentTitle: () => undefined,
}));
jest.mock('../../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({
    term: (value: string, plural?: boolean) => (plural ? `${value}s` : value),
  }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import LocationsScreen from '../../../src/screens/locations/LocationListScreen';

const freshListState = () => ({
  listProps: {},
  items: [] as { id: string; name: string }[],
  isInitialLoading: false,
  error: null as string | null,
  storyId: 'story-1' as string | undefined,
  advancedSearchCriteria: null,
  setAdvancedSearchCriteria: mockSetAdvancedSearchCriteria,
  toggleFavorite: mockToggleFavorite,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockListState = freshListState();
  mockListProps = null;
  mockUseEntityListScreen.mockImplementation(() => mockListState);
  mockGetTagsByStoryId.mockResolvedValue([]);
});

it('requests its guided tour', async () => {
  await render(<LocationsScreen />);

  expect(mockUseScreenTour).toHaveBeenCalledWith('LocationsStack');
});

it('binds the location store through the shared list hook', async () => {
  await render(<LocationsScreen />);

  expect(mockUseEntityListScreen).toHaveBeenCalledWith(
    expect.objectContaining({ collectionKey: 'locations', changeEvent: 'location_changed' }),
  );
});

it('guides the empty list toward creation', async () => {
  await render(<LocationsScreen />);

  expect(mockListProps?.emptyStateTitle).toBe('locations_empty_title');
  expect(mockListProps?.emptyStateMessage).toBe('locations_empty_message');
  expect(mockListProps?.emptyStateActions?.map((action) => action.label)).toEqual([
    'locations_empty_create',
  ]);
  mockListProps?.emptyStateActions?.[0].onPress();
  expect(mockNavigate).toHaveBeenCalledWith('LocationForm', { locationId: undefined });
});

it('shows loading and error states from the list hook', async () => {
  mockListState = { ...freshListState(), isInitialLoading: true };
  const loading = await render(<LocationsScreen />);
  expect(loading.getByTestId('screen-loading')).toBeTruthy();
  loading.unmount();

  mockListState = { ...freshListState(), error: 'load failed' };
  const failed = await render(<LocationsScreen />);
  fireEvent.press(failed.getByTestId('screen-error'));
  expect(mockGoBack).toHaveBeenCalled();
});

it('renders locations with tag filters and wires item actions', async () => {
  mockGetTagsByStoryId.mockResolvedValue([{ id: 'tag-1', name: 'City', color: '#f00' }]);
  mockListState = {
    ...freshListState(),
    items: [{ id: 'loc-1', name: 'Keep' }],
  };
  const screen = await render(<LocationsScreen />);

  await waitFor(() => expect(mockGetTagsByStoryId).toHaveBeenCalledWith('story-1'));
  expect(screen.getByTestId('location-list-stub')).toBeTruthy();
  expect(mockListProps?.filterOptions).toEqual([{ label: 'City', value: 'tag-1', color: '#f00' }]);
  expect(mockListProps?.sortOptions.map((option) => option.value)).toEqual([
    'name',
    'createdAt',
    'updatedAt',
  ]);

  fireEvent.press(screen.getByTestId('fav-loc-1'));
  expect(mockToggleFavorite).toHaveBeenCalledWith('loc-1', true);

  fireEvent.press(screen.getByTestId('view-loc-1'));
  expect(mockNavigate).toHaveBeenCalledWith('LocationDetail', { locationId: 'loc-1' });
});
