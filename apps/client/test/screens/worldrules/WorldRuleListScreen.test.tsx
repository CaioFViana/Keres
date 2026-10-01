import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockToggleFavorite = jest.fn();
const mockGetTagsByStoryId = jest.fn();
const mockUseEntityListScreen = jest.fn();
const mockUseScreenHeader = jest.fn();
let mockRouteParams: { section?: string } | undefined;

interface WorldRuleItem {
  id: string;
  title: string;
  section: string;
  isFavorite?: boolean;
}

const freshListState = () => ({
  listProps: {},
  items: [] as WorldRuleItem[],
  isInitialLoading: false,
  error: null as string | null,
  storyId: 'story-1' as string | undefined,
  toggleFavorite: mockToggleFavorite,
});

let mockListState = freshListState();
let mockListProps: {
  data: WorldRuleItem[];
  renderItem: (info: { item: WorldRuleItem }) => React.ReactNode;
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
    useRoute: () => ({ params: mockRouteParams }),
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (...args: unknown[]) => mockUseScreenHeader(...args),
}));
jest.mock('@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList', () => ({
  __esModule: true,
  default: (props: {
    data: WorldRuleItem[];
    renderItem: (info: { item: WorldRuleItem }) => React.ReactNode;
    filterOptions: { label: string; value: string }[];
    sortOptions: { label: string; value: string }[];
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    mockListProps = props;
    return react.createElement(
      native.View,
      { testID: 'worldrule-list-stub' },
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
jest.mock('@/src/components/features/list-items/WorldRuleListItem', () => ({
  __esModule: true,
  default: ({
    worldRule,
    onToggleFavorite,
    onViewDetails,
  }: {
    worldRule: WorldRuleItem;
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
          testID: `fav-${worldRule.id}`,
          onPress: () => onToggleFavorite(worldRule.id, !worldRule.isFavorite),
        },
        `fav ${worldRule.title}`,
      ),
      react.createElement(
        native.Text,
        { testID: `view-${worldRule.id}`, onPress: () => onViewDetails(worldRule.id) },
        `view ${worldRule.title}`,
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
jest.mock('@/src/state/worldRuleStore', () => ({
  __esModule: true,
  useWorldRuleStore: jest.fn(),
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

import WorldRulesScreen from '../../../src/screens/worldrules/WorldRuleListScreen';
import { entityEventEmitter } from '../../../src/utils/EventEmitter';

beforeEach(() => {
  jest.clearAllMocks();
  mockListState = freshListState();
  mockListProps = null;
  mockRouteParams = undefined;
  mockUseEntityListScreen.mockImplementation(() => mockListState);
  mockGetTagsByStoryId.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

it('binds the world rule store through the shared list hook', async () => {
  await render(<WorldRulesScreen />);

  expect(mockUseEntityListScreen).toHaveBeenCalledWith(
    expect.objectContaining({ collectionKey: 'worldRules', changeEvent: 'worldrule_changed' }),
  );
});

it('guides the empty list toward creation', async () => {
  await render(<WorldRulesScreen />);

  expect(mockListProps?.emptyStateTitle).toBe('worldrules_empty_title');
  expect(mockListProps?.emptyStateMessage).toBe('worldrules_empty_message');
  expect(mockListProps?.emptyStateActions?.map((action) => action.label)).toEqual([
    'worldrules_empty_create',
  ]);
  mockListProps?.emptyStateActions?.[0].onPress();
  expect(mockNavigate).toHaveBeenCalledWith('WorldRuleForm', { worldRuleId: undefined });
});

it('shows loading and error states from the list hook', async () => {
  mockListState = { ...freshListState(), isInitialLoading: true };
  const loading = await render(<WorldRulesScreen />);
  expect(loading.getByTestId('screen-loading')).toBeTruthy();

  mockListState = { ...freshListState(), error: 'load failed' };
  const failed = await render(<WorldRulesScreen />);
  await fireEvent.press(failed.getByTestId('screen-error'));
  expect(mockGoBack).toHaveBeenCalled();
});

it('renders rules with tag filters and wires item actions', async () => {
  mockGetTagsByStoryId.mockResolvedValue([{ id: 'tag-1', name: 'Magic', color: '#f00' }]);
  mockListState = {
    ...freshListState(),
    items: [{ id: 'wr-1', title: 'Gravity', section: 'rule' }],
  };
  const view = await render(<WorldRulesScreen />);

  await waitFor(() => expect(mockGetTagsByStoryId).toHaveBeenCalledWith('story-1'));
  expect(view.getByTestId('worldrule-list-stub')).toBeTruthy();
  expect(mockListProps?.filterOptions).toEqual([{ label: 'Magic', value: 'tag-1', color: '#f00' }]);
  expect(mockListProps?.sortOptions.map((option) => option.value)).toEqual([
    'title',
    'createdAt',
    'updatedAt',
  ]);

  await fireEvent.press(view.getByTestId('fav-wr-1'));
  expect(mockToggleFavorite).toHaveBeenCalledWith('wr-1', true);

  await fireEvent.press(view.getByTestId('view-wr-1'));
  expect(mockNavigate).toHaveBeenCalledWith('WorldRuleDetail', { worldRuleId: 'wr-1' });
});

it('filters by section when the route carries one', async () => {
  mockRouteParams = { section: 'rule' };
  mockListState = {
    ...freshListState(),
    items: [
      { id: 'wr-1', title: 'Gravity', section: 'rule' },
      { id: 'wr-2', title: 'Sword', section: 'item' },
    ],
  };
  const view = await render(<WorldRulesScreen />);

  expect(mockListProps?.data.map((item) => item.id)).toEqual(['wr-1']);
  expect(view.queryByTestId('view-wr-2')).toBeNull();
  const header = mockUseScreenHeader.mock.calls[mockUseScreenHeader.mock.calls.length - 1][0] as {
    title: string;
  };
  expect(header.title).toBe('world_piece_section_rule');
});

it('uses the vocabulary title without a section and refetches tags on change', async () => {
  const view = await render(<WorldRulesScreen />);
  expect(view.getByTestId('worldrule-list-stub')).toBeTruthy();
  const header = mockUseScreenHeader.mock.calls[mockUseScreenHeader.mock.calls.length - 1][0] as {
    title: string;
    actions: { onPress: () => void }[];
  };
  expect(header.title).toBe('WorldRules');
  header.actions[0]!.onPress();
  expect(mockNavigate).toHaveBeenCalledWith('WorldRuleForm', { worldRuleId: undefined });

  const callsBefore = mockGetTagsByStoryId.mock.calls.length;
  entityEventEmitter.emit('tag_changed', 'other-story');
  await waitFor(() => expect(mockGetTagsByStoryId.mock.calls.length).toBe(callsBefore));
  entityEventEmitter.emit('tag_changed', 'story-1');
  await waitFor(() => expect(mockGetTagsByStoryId.mock.calls.length).toBeGreaterThan(callsBefore));
});

it('clears tag filters without a story', async () => {
  mockListState = { ...freshListState(), storyId: undefined };
  await render(<WorldRulesScreen />);

  await waitFor(() => expect(mockListProps?.filterOptions).toEqual([]));
  expect(mockGetTagsByStoryId).not.toHaveBeenCalled();
});
