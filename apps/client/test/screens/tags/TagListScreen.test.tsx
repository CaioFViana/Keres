import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockToggleFavorite = jest.fn();
const mockUseEntityListScreen = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockUseScreenTour = jest.fn();

interface TagItem {
  id: string;
  name: string;
  isFavorite?: boolean;
}

const freshListState = () => ({
  listProps: {},
  items: [] as TagItem[],
  isInitialLoading: false,
  error: null as string | null,
  storyId: 'story-1' as string | undefined,
  toggleFavorite: mockToggleFavorite,
});

let mockListState = freshListState();
let mockListProps: {
  data: TagItem[];
  renderItem: (info: { item: TagItem }) => React.ReactNode;
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
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (...args: unknown[]) => mockUseScreenHeader(...args),
}));
jest.mock('../../../src/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
}));
jest.mock('@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList', () => ({
  __esModule: true,
  default: (props: {
    data: TagItem[];
    renderItem: (info: { item: TagItem }) => React.ReactNode;
    sortOptions: { label: string; value: string }[];
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    mockListProps = props;
    return react.createElement(
      native.View,
      { testID: 'tag-list-stub' },
      props.data.map((item) =>
        react.createElement(react.Fragment, { key: item.id }, props.renderItem({ item })),
      ),
    );
  },
}));
jest.mock('@/src/components/layout/ScreenContainer/ScreenContainer', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.View, { testID: 'screen-container' }, children);
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
jest.mock('@/src/components/features/list-items/TagListItem', () => ({
  __esModule: true,
  default: ({
    tag,
    onToggleFavorite,
    onViewDetails,
  }: {
    tag: TagItem;
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
          testID: `fav-${tag.id}`,
          onPress: () => onToggleFavorite(tag.id, !tag.isFavorite),
        },
        `fav ${tag.name}`,
      ),
      react.createElement(
        native.Text,
        { testID: `view-${tag.id}`, onPress: () => onViewDetails(tag.id) },
        `view ${tag.name}`,
      ),
    );
  },
}));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useEntityListScreen', () => ({
  __esModule: true,
  useEntityListScreen: (...args: unknown[]) => mockUseEntityListScreen(...args),
}));
jest.mock('../../../src/state/tagStore', () => ({
  __esModule: true,
  useTagStore: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import TagsScreen from '../../../src/screens/tags/TagListScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockListState = freshListState();
  mockListProps = null;
  mockUseEntityListScreen.mockImplementation(() => mockListState);
});

afterEach(() => {
  cleanup();
});

it('requests its guided tour', async () => {
  await render(<TagsScreen />);

  expect(mockUseScreenTour).toHaveBeenCalledWith('TagsStack');
});

it('guides the empty list toward creation', async () => {
  await render(<TagsScreen />);

  expect(mockListProps?.emptyStateTitle).toBe('tags_empty_title');
  expect(mockListProps?.emptyStateMessage).toBe('tags_empty_message');
  expect(mockListProps?.emptyStateActions?.map((action) => action.label)).toEqual([
    'tags_empty_create',
  ]);
  mockListProps?.emptyStateActions?.[0].onPress();
  expect(mockNavigate).toHaveBeenCalledWith('TagForm', { tagId: undefined });
});

it('binds the tag store through the shared list hook', async () => {
  await render(<TagsScreen />);

  expect(mockUseEntityListScreen).toHaveBeenCalledWith(
    expect.objectContaining({ collectionKey: 'tags', changeEvent: 'tag_changed' }),
  );
});

it('shows the loading state from the list hook', async () => {
  mockListState = { ...freshListState(), isInitialLoading: true };
  const view = await render(<TagsScreen />);
  expect(view.getByTestId('screen-loading').props.children).toBe('loading_tags');
});

it('shows the error state and goes back on press', async () => {
  mockListState = { ...freshListState(), error: 'load failed' };
  const view = await render(<TagsScreen />);
  expect(view.getByTestId('screen-error').props.children).toBe('load failed');
  await fireEvent.press(view.getByTestId('screen-error'));
  expect(mockGoBack).toHaveBeenCalled();
});

it('renders tags with sort options and wires item actions', async () => {
  mockListState = {
    ...freshListState(),
    items: [{ id: 'tag-1', name: 'Urgent' }],
  };
  const view = await render(<TagsScreen />);

  expect(view.getByTestId('tag-list-stub')).toBeTruthy();
  expect(mockListProps?.sortOptions.map((option) => option.value)).toEqual([
    'name',
    'createdAt',
    'updatedAt',
  ]);

  await fireEvent.press(view.getByTestId('fav-tag-1'));
  expect(mockToggleFavorite).toHaveBeenCalledWith('tag-1', true);

  await fireEvent.press(view.getByTestId('view-tag-1'));
  expect(mockNavigate).toHaveBeenCalledWith('TagDetail', { tagId: 'tag-1' });
});

it('registers the add header action opening the tag form', async () => {
  await render(<TagsScreen />);

  const header = mockUseScreenHeader.mock.calls[mockUseScreenHeader.mock.calls.length - 1][0] as {
    title: string;
    actions: { onPress: () => void }[];
  };
  expect(header.title).toBe('tags_title');
  header.actions[0]!.onPress();
  expect(mockNavigate).toHaveBeenCalledWith('TagForm', { tagId: undefined });
});
