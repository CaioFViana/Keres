import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockToggleFavorite = jest.fn();
const mockOpenItemList = jest.fn();
const mockUseEntityListScreen = jest.fn();
const mockUseScreenTour = jest.fn();
const mockGetJourneys = jest.fn();
const mockGetScenes = jest.fn();
const mockGetChapters = jest.fn();
const mockGetChoices = jest.fn();
const mockGetCharacters = jest.fn();
const mockGetTagsByStoryId = jest.fn();
const mockGetTagsForEntity = jest.fn();
const mockHeaderConfig: { current: { actions: { onPress: () => void }[] } | null } = {
  current: null,
};
let mockListState = {
  listProps: {},
  items: [] as { id: string; name: string; characterOwnerId?: string | null }[],
  isInitialLoading: false,
  error: null as string | null,
  storyId: 'story-1' as string | undefined,
  toggleFavorite: mockToggleFavorite,
};
let mockListProps: {
  data: { id: string; name: string }[];
  renderItem: (info: { item: { id: string; name: string } }) => React.ReactNode;
  filterOptions: { label: string; value: string }[];
  sortOptions: { label: string; value: string }[];
  onFilterChange: (ids: string[]) => void;
} | null = null;
let mockJourneyRowsProps: {
  journeys: unknown[];
  onOpenJourney: (id: string) => void;
  onAddJourney: () => void;
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
jest.mock('@/src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (config: unknown) => {
    mockHeaderConfig.current = config as never;
  },
}));
jest.mock('@/src/guides/useScreenTour', () => ({
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
    onFilterChange: (ids: string[]) => void;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    mockListProps = props;
    return react.createElement(
      native.View,
      { testID: 'item-list-stub' },
      react.createElement(
        native.Text,
        { testID: 'filter-tags', onPress: () => props.onFilterChange(['tag-1']) },
        'filter',
      ),
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
jest.mock('@/src/components/features/list-items/ItemListItem', () => ({
  __esModule: true,
  default: ({
    item,
    onViewDetails,
    onToggleFavorite,
    characterOwnerName,
    renderJourneys,
  }: {
    item: { id: string; name: string; isFavorite?: boolean };
    onViewDetails: (id: string) => void;
    onToggleFavorite: (id: string, isFavorite: boolean) => void;
    characterOwnerName?: string;
    renderJourneys: () => React.ReactNode;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      null,
      react.createElement(
        native.Text,
        {
          testID: `fav-${item.id}`,
          onPress: () => onToggleFavorite(item.id, !item.isFavorite),
        },
        `fav ${item.name}`,
      ),
      react.createElement(
        native.Text,
        { testID: `view-${item.id}`, onPress: () => onViewDetails(item.id) },
        `view ${item.name} ${characterOwnerName ?? 'no-owner'}`,
      ),
      react.createElement(react.Fragment, null, renderJourneys()),
    );
  },
}));
jest.mock('@/src/components/features/item-journeys/ItemJourneyRows', () => ({
  __esModule: true,
  default: (props: {
    journeys: unknown[];
    onOpenJourney: (id: string) => void;
    onAddJourney: () => void;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    mockJourneyRowsProps = props;
    return react.createElement(
      native.View,
      null,
      react.createElement(
        native.Text,
        { testID: 'journeys-marker' },
        `journeys:${props.journeys.length}`,
      ),
      react.createElement(
        native.Text,
        { testID: 'open-journey', onPress: () => props.onOpenJourney('journey-1') },
        'open',
      ),
      react.createElement(
        native.Text,
        { testID: 'add-journey', onPress: props.onAddJourney },
        'add',
      ),
    );
  },
}));
const mockDb = {};
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useEntityListScreen', () => ({
  __esModule: true,
  useEntityListScreen: (...args: unknown[]) => mockUseEntityListScreen(...args),
}));
jest.mock('../../../src/hooks/useOpenPresenceMatrixViewer', () => ({
  __esModule: true,
  useOpenPresenceMatrixViewer: () => ({ openItemList: mockOpenItemList }),
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: true }),
}));
jest.mock('../../../src/services/storymanagement/ItemJourneyService', () => ({
  __esModule: true,
  createItemJourneyService: () => ({ getAllByStoryId: mockGetJourneys }),
}));
jest.mock('../../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: () => ({ getAllByStoryId: mockGetScenes }),
}));
jest.mock('../../../src/services/storymanagement/ChapterService', () => ({
  __esModule: true,
  createChapterService: () => ({ getAllByStoryId: mockGetChapters }),
}));
jest.mock('../../../src/services/storymanagement/ChoiceService', () => ({
  __esModule: true,
  createChoiceService: () => ({ getAllByStoryId: mockGetChoices }),
}));
jest.mock('../../../src/services/storymanagement/CharacterService', () => ({
  __esModule: true,
  createCharacterService: () => ({ getAllByStoryId: mockGetCharacters }),
}));
jest.mock('../../../src/services/storymanagement/TagService', () => ({
  __esModule: true,
  createTagService: () => ({ getTagsByStoryId: mockGetTagsByStoryId }),
}));
jest.mock('../../../src/services/storymanagement/TagRelationService', () => ({
  __esModule: true,
  createTagRelationService: () => ({ getTagsForEntity: mockGetTagsForEntity }),
}));
jest.mock('../../../src/state/itemStore', () => ({
  __esModule: true,
  useItemStore: jest.fn(),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector: (state: unknown) => unknown) =>
    selector({ selectedStory: { id: 'story-1', type: 'linear' } }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      primaryContainer: '#ccf',
      secondary: '#888',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));
jest.mock('../../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({
    agree: () => 'o',
    term: (value: string, plural?: boolean) => (plural ? `${value}s` : value),
  }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import ItemListScreen from '../../../src/screens/items/ItemListScreen';

const freshListState = () => ({
  listProps: {},
  items: [] as { id: string; name: string; characterOwnerId?: string | null }[],
  isInitialLoading: false,
  error: null as string | null,
  storyId: 'story-1' as string | undefined,
  toggleFavorite: mockToggleFavorite,
});

describe('ItemListScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockListState = freshListState();
    mockListProps = null;
    mockJourneyRowsProps = null;
    mockHeaderConfig.current = null;
    mockUseEntityListScreen.mockImplementation(() => mockListState);
    mockGetJourneys.mockResolvedValue([]);
    mockGetScenes.mockResolvedValue([]);
    mockGetChapters.mockResolvedValue([]);
    mockGetChoices.mockResolvedValue([]);
    mockGetCharacters.mockResolvedValue([]);
    mockGetTagsByStoryId.mockResolvedValue([]);
    mockGetTagsForEntity.mockResolvedValue([]);
  });

  it('requests its guided tour', async () => {
    await render(<ItemListScreen />);

    expect(mockUseScreenTour).toHaveBeenCalledWith('ItemsStack');
  });

  it('binds the item store through the shared list hook', async () => {
    const view = await render(<ItemListScreen />);

    expect(mockUseEntityListScreen).toHaveBeenCalledWith(
      expect.objectContaining({ collectionKey: 'items', changeEvent: 'item_changed' }),
    );
    expect(view.getByTestId('item-list-stub')).toBeTruthy();
  });

  it('shows loading and error states from the list hook', async () => {
    mockListState = { ...freshListState(), isInitialLoading: true };
    const loading = await render(<ItemListScreen />);
    expect(loading.getByTestId('screen-loading')).toBeTruthy();

    mockListState = { ...freshListState(), error: 'load failed' };
    const failed = await render(<ItemListScreen />);
    await fireEvent.press(failed.getByTestId('screen-error'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('renders items with tags, owners and journeys, wiring all actions', async () => {
    mockGetTagsByStoryId.mockResolvedValue([{ id: 'tag-1', name: 'Relic', color: '#f00' }]);
    mockGetTagsForEntity.mockResolvedValue([{ id: 'tag-1', name: 'Relic', color: '#f00' }]);
    mockGetCharacters.mockResolvedValue([{ id: 'char-1', name: 'Aria' }]);
    mockGetJourneys.mockResolvedValue([{ id: 'journey-1', itemId: 'item-1' }]);
    mockListState = {
      ...freshListState(),
      items: [{ id: 'item-1', name: 'Sword', characterOwnerId: 'char-1' }],
    };
    const view = await render(<ItemListScreen />);

    await waitFor(() => expect(mockGetJourneys).toHaveBeenCalledWith('story-1'));
    await waitFor(() =>
      expect(mockListProps?.filterOptions).toEqual([
        { label: 'Relic', value: 'tag-1', color: '#f00' },
      ]),
    );
    expect(mockListProps?.sortOptions.map((option) => option.value)).toEqual([
      'name',
      'category',
      'createdAt',
      'updatedAt',
    ]);
    expect(view.getByText('view Sword Aria')).toBeTruthy();
    expect(view.getByTestId('journeys-marker').props.children).toBe('journeys:1');
    expect(mockJourneyRowsProps?.journeys).toHaveLength(1);

    await fireEvent.press(view.getByTestId('fav-item-1'));
    expect(mockToggleFavorite).toHaveBeenCalledWith('item-1', true);

    await fireEvent.press(view.getByTestId('view-item-1'));
    expect(mockNavigate).toHaveBeenCalledWith('ItemDetail', { itemId: 'item-1' });

    await fireEvent.press(view.getByTestId('open-journey'));
    expect(mockNavigate).toHaveBeenCalledWith('ItemJourneyDetail', {
      itemJourneyId: 'journey-1',
    });

    await fireEvent.press(view.getByTestId('add-journey'));
    expect(mockNavigate).toHaveBeenCalledWith('ItemJourneyForm', { itemId: 'item-1' });
  });

  it('filters items by the selected tag', async () => {
    mockGetTagsForEntity.mockImplementation(async (_storyId: string, itemId: string) =>
      itemId === 'item-1' ? [{ id: 'tag-1', name: 'Relic' }] : [],
    );
    mockListState = {
      ...freshListState(),
      items: [
        { id: 'item-1', name: 'Sword' },
        { id: 'item-2', name: 'Shield' },
      ],
    };
    const view = await render(<ItemListScreen />);

    await waitFor(() => expect(mockListProps?.data).toHaveLength(2));
    await fireEvent.press(view.getByTestId('filter-tags'));
    await waitFor(() => expect(mockListProps?.data).toHaveLength(1));
    expect(mockListProps?.data[0].id).toBe('item-1');
  });

  it('opens the presence matrix and the item form from header actions', async () => {
    await render(<ItemListScreen />);

    expect(mockHeaderConfig.current?.actions).toHaveLength(2);
    mockHeaderConfig.current?.actions[0].onPress();
    expect(mockOpenItemList).toHaveBeenCalled();
    mockHeaderConfig.current?.actions[1].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('ItemForm', {});
  });
});
