import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();
const mockToggleFavorite = jest.fn();
const mockSetAdvancedSearchCriteria = jest.fn();
const mockGetTagsByStoryId = jest.fn();
const mockGetCharacterRelationsByStoryId = jest.fn();
const mockGetAllCharactersByStoryId = jest.fn();
const mockOpenCharacterList = jest.fn();
const mockUseEntityListScreen = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockUseScreenTour = jest.fn();
const mockReadShowcaseRequest = jest.fn();
const mockUseStoryStore = jest.fn();

type ListItem = { id: string; name: string; isFavorite?: boolean; isDeleted?: boolean };

let mockListState = {
  listProps: {},
  items: [] as ListItem[],
  isInitialLoading: false,
  error: null as string | null,
  storyId: 'story-1' as string | undefined,
  advancedSearchCriteria: null,
  setAdvancedSearchCriteria: mockSetAdvancedSearchCriteria,
  toggleFavorite: mockToggleFavorite,
};
let mockListProps: {
  data: ListItem[];
  renderItem: (info: { item: ListItem }) => React.ReactNode;
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
      replace: mockReplace,
      getParent: () => ({ setOptions: jest.fn() }),
    }),
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList', () => ({
  __esModule: true,
  default: (props: {
    data: ListItem[];
    renderItem: (info: { item: ListItem }) => React.ReactNode;
    filterOptions: { label: string; value: string }[];
    sortOptions: { label: string; value: string }[];
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    mockListProps = props;
    return react.createElement(
      native.View,
      { testID: 'character-list-stub' },
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
jest.mock('@/src/components/features/list-items/CharacterListItem', () => ({
  __esModule: true,
  default: ({
    character,
    onToggleFavorite,
    onViewDetails,
    renderRelations,
  }: {
    character: ListItem;
    onToggleFavorite: (id: string, isFavorite: boolean) => void;
    onViewDetails: (id: string) => void;
    renderRelations: (args: {
      expanded: boolean;
      onExpandedChange: (next: boolean) => void;
    }) => React.ReactNode;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      null,
      react.createElement(
        native.Text,
        {
          testID: `fav-${character.id}`,
          onPress: () => onToggleFavorite(character.id, !character.isFavorite),
        },
        `fav ${character.name}`,
      ),
      react.createElement(
        native.Text,
        { testID: `view-${character.id}`, onPress: () => onViewDetails(character.id) },
        `view ${character.name}`,
      ),
      renderRelations({ expanded: false, onExpandedChange: jest.fn() }),
    );
  },
}));
jest.mock('@/src/components/features/relations/CharacterRelationRows', () => ({
  __esModule: true,
  default: ({
    characterId,
    relations,
    characters,
  }: {
    characterId: string;
    relations: unknown[];
    characters: unknown[];
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.Text,
      { testID: `relations-${characterId}` },
      `${relations.length}:${characters.length}`,
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
jest.mock('../../../src/hooks/useOpenPresenceMatrixViewer', () => ({
  __esModule: true,
  useOpenPresenceMatrixViewer: () => ({ openCharacterList: mockOpenCharacterList }),
}));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (config: unknown) => mockUseScreenHeader(config),
}));
jest.mock('../../../src/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: true }),
}));
jest.mock('../../../src/services/storymanagement/TagService', () => ({
  __esModule: true,
  createTagService: () => ({ getTagsByStoryId: mockGetTagsByStoryId }),
}));
jest.mock('../../../src/services/storymanagement/CharacterRelationService', () => ({
  __esModule: true,
  createCharacterRelationService: () => ({
    getCharacterRelationsByStoryId: mockGetCharacterRelationsByStoryId,
  }),
}));
jest.mock('../../../src/services/storymanagement/CharacterService', () => ({
  __esModule: true,
  createCharacterService: () => ({
    getAllByStoryId: mockGetAllCharactersByStoryId,
  }),
}));
jest.mock('../../../src/state/characterStore', () => ({
  __esModule: true,
  useCharacterStore: jest.fn(),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector: (state: object) => unknown) => mockUseStoryStore(selector),
}));
jest.mock('../../../src/showcase/showcaseRequest', () => ({
  __esModule: true,
  readShowcaseRequest: () => mockReadShowcaseRequest(),
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

import CharactersScreen from '../../../src/screens/characters/CharacterListScreen';

const freshListState = () => ({
  listProps: {},
  items: [] as ListItem[],
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
  mockGetCharacterRelationsByStoryId.mockResolvedValue([]);
  mockGetAllCharactersByStoryId.mockResolvedValue([]);
  mockReadShowcaseRequest.mockReturnValue(null);
  mockUseStoryStore.mockImplementation((selector: (state: object) => unknown) =>
    selector({ selectedStory: { id: 'story-1', type: 'linear' } }),
  );
});

type HeaderAction = { id: string; onPress: () => void; visible?: boolean };

function headerActions(): HeaderAction[] {
  const lastCall = mockUseScreenHeader.mock.calls[mockUseScreenHeader.mock.calls.length - 1];
  return (lastCall[0] as { actions: HeaderAction[] }).actions;
}

describe('CharacterListScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('binds the character store through the shared list hook', async () => {
    await render(<CharactersScreen />);
    expect(mockUseEntityListScreen).toHaveBeenCalledWith(
      expect.objectContaining({ collectionKey: 'characters', changeEvent: 'character_changed' }),
    );
  });

  it('shows loading and error states from the list hook', async () => {
    mockListState = { ...freshListState(), isInitialLoading: true };
    const loading = await render(<CharactersScreen />);
    expect(loading.getByTestId('screen-loading')).toBeTruthy();
  });

  it('requests its guided tour', async () => {
    await render(<CharactersScreen />);

    expect(mockUseScreenTour).toHaveBeenCalledWith('CharactersStack');
  });

  it('guides the empty list toward creation', async () => {
    await render(<CharactersScreen />);

    expect(mockListProps?.emptyStateTitle).toBe('characters_empty_title');
    expect(mockListProps?.emptyStateMessage).toBe('characters_empty_message');
    expect(mockListProps?.emptyStateActions?.map((action) => action.label)).toEqual([
      'characters_empty_create',
    ]);
    mockListProps?.emptyStateActions?.[0].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('CharacterForm', { characterId: undefined });
  });

  it('shows the error state with a back action', async () => {
    mockListState = { ...freshListState(), error: 'load failed' };
    const failed = await render(<CharactersScreen />);
    await fireEvent.press(failed.getByTestId('screen-error'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('renders characters with tag filters and wires item actions', async () => {
    mockGetTagsByStoryId.mockResolvedValue([{ id: 'tag-1', name: 'Hero', color: '#f00' }]);
    mockGetCharacterRelationsByStoryId.mockResolvedValue([{ id: 'rel-1' }]);
    mockGetAllCharactersByStoryId.mockResolvedValue([
      { id: 'char-1', name: 'Aria' },
      { id: 'char-2', name: 'Bram' },
    ]);
    mockListState = {
      ...freshListState(),
      items: [{ id: 'char-1', name: 'Aria' }],
    };
    const screen = await render(<CharactersScreen />);

    await waitFor(() => expect(mockGetTagsByStoryId).toHaveBeenCalledWith('story-1'));
    await waitFor(() => expect(mockGetCharacterRelationsByStoryId).toHaveBeenCalledWith('story-1'));
    expect(screen.getByTestId('character-list-stub')).toBeTruthy();
    expect(mockListProps?.filterOptions).toEqual([
      { label: 'Hero', value: 'tag-1', color: '#f00' },
    ]);
    expect(mockListProps?.sortOptions.map((option) => option.value)).toEqual([
      'name',
      'createdAt',
      'updatedAt',
    ]);
    expect(screen.getByTestId('relations-char-1').props.children).toBe('1:2');

    await fireEvent.press(screen.getByTestId('fav-char-1'));
    expect(mockToggleFavorite).toHaveBeenCalledWith('char-1', true);

    await fireEvent.press(screen.getByTestId('view-char-1'));
    expect(mockNavigate).toHaveBeenCalledWith('CharacterDetail', { characterId: 'char-1' });
  });

  it('wires the header actions for matrix, relation map and creation', async () => {
    await render(<CharactersScreen />);
    const actions = headerActions();
    expect(actions.map((action) => action.id)).toEqual(['action-0', 'action-1', 'action-2']);
    expect(actions[0].visible).toBe(true);
    actions[0].onPress();
    expect(mockOpenCharacterList).toHaveBeenCalledTimes(1);
    actions[1].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('CharacterRelationView');
    actions[2].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('CharacterForm', { characterId: undefined });
  });

  it('opens a showcase-requested character detail', async () => {
    mockReadShowcaseRequest.mockReturnValue({
      stack: 'CharactersStack',
      screen: 'CharacterDetail',
      focusName: 'Aria',
    });
    mockListState = {
      ...freshListState(),
      items: [
        { id: 'char-1', name: 'Aria' },
        { id: 'char-2', name: 'Bram' },
      ],
    };
    await render(<CharactersScreen />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('CharacterDetail', { characterId: 'char-1' }),
    );
  });

  it('ignores showcase requests for other stacks', async () => {
    mockReadShowcaseRequest.mockReturnValue({
      stack: 'LocationsStack',
      screen: 'LocationDetail',
      focusName: 'Keep',
    });
    mockListState = {
      ...freshListState(),
      items: [{ id: 'char-1', name: 'Aria' }],
    };
    await render(<CharactersScreen />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
