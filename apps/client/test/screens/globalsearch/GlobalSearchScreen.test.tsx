import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockSearchAllEntities = jest.fn();
const mockNavigateToEntityDetail = jest.fn();
let mockStory: { id: string } | null = { id: 'story-1' };
let mockUserId: string | null = 'user-1';

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('@expo/vector-icons', () => ({
  __esModule: true,
  Ionicons: ({ name }: { name: string }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: `icon-${name}` }, name);
  },
}));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: () => undefined,
}));
jest.mock('@/src/components/common/inputs/TextInput/TextInput', () => ({
  __esModule: true,
  default: (props: { value: string; onChangeText: (value: string) => void }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.TextInput, {
      testID: 'search-input',
      value: props.value,
      onChangeText: props.onChangeText,
    });
  },
}));
jest.mock('@/src/components/features/list-items/GlobalSearchResultItem', () => ({
  __esModule: true,
  default: ({
    result,
    onPress,
  }: {
    result: { id: string; entityType: string; title: string };
    onPress: (result: unknown) => void;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.Text,
      { testID: `result-${result.id}`, onPress: () => onPress(result) },
      result.title,
    );
  },
}));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => ({}) }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/services/storymanagement/GlobalSearchService', () => ({
  __esModule: true,
  createGlobalSearchService: () => ({ searchAllEntities: mockSearchAllEntities }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockStory }),
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: mockUserId }),
}));
jest.mock('../../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({
    label: (value: string, plural?: boolean) => (plural ? `${value}s` : value),
  }),
}));
jest.mock('../../../src/utils/debounce', () => ({
  __esModule: true,
  debounce: (fn: (value: string) => void) => {
    const debounced = (value: string) => fn(value);
    debounced.cancel = jest.fn();
    return debounced;
  },
}));
jest.mock('../../../src/utils/entityNavigation', () => ({
  __esModule: true,
  navigateToEntityDetail: (...args: unknown[]) => mockNavigateToEntityDetail(...args),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      accent: '#0aa',
      background: '#fff',
      notification: '#f80',
      primary: '#00f',
      textSecondary: '#666',
    },
  }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import GlobalSearchScreen from '../../../src/screens/globalsearch/GlobalSearchScreen';

const makeResult = (overrides = {}) => ({
  id: 'char-1',
  entityType: 'Character',
  title: 'Aria',
  subtitle: null,
  isFavorite: true,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockStory = { id: 'story-1' };
  mockUserId = 'user-1';
  mockSearchAllEntities.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

async function typeQuery(view: { getByTestId: (id: string) => unknown }, query: string) {
  await fireEvent.changeText(view.getByTestId('search-input') as never, query);
}

it('prompts for a longer query and skips searching', async () => {
  const view = await render(<GlobalSearchScreen />);

  expect(view.getByText('global_search_prompt')).toBeTruthy();
  await typeQuery(view, 'a');
  expect(mockSearchAllEntities).not.toHaveBeenCalled();
  expect(view.getByText('global_search_prompt')).toBeTruthy();
});

it('searches and renders grouped sections', async () => {
  mockSearchAllEntities.mockResolvedValue([
    makeResult({ id: 'char-1', title: 'Aria' }),
    makeResult({ id: 'loc-1', entityType: 'Location', title: 'Keep', isFavorite: false }),
  ]);
  const view = await render(<GlobalSearchScreen />);

  await typeQuery(view, 'ar');
  await waitFor(() =>
    expect(mockSearchAllEntities).toHaveBeenCalledWith('story-1', 'ar', 'user-1'),
  );
  await waitFor(() => expect(view.getByText('Characters (1)')).toBeTruthy());
  expect(view.getByText('Locations (1)')).toBeTruthy();
  expect(view.getByTestId('result-char-1')).toBeTruthy();

  await fireEvent.press(view.getByTestId('result-char-1'));
  expect(mockNavigateToEntityDetail).toHaveBeenCalledWith(expect.anything(), 'Character', 'char-1');
});

it('shows the empty state without results', async () => {
  const view = await render(<GlobalSearchScreen />);

  await typeQuery(view, 'zzz');
  await waitFor(() => expect(mockSearchAllEntities).toHaveBeenCalled());
  await waitFor(() => expect(view.getByText('global_search_no_results')).toBeTruthy());
});

it('cycles the favorite filter and narrows sections', async () => {
  mockSearchAllEntities.mockResolvedValue([
    makeResult({ id: 'char-1', title: 'Aria', isFavorite: true }),
    makeResult({ id: 'char-2', title: 'Bram', isFavorite: false }),
    makeResult({ id: 'note-1', entityType: 'Note', title: 'Memo', isFavorite: null }),
  ]);
  const view = await render(<GlobalSearchScreen />);

  await typeQuery(view, 'ar');
  await waitFor(() => expect(view.getByText('Characters (2)')).toBeTruthy());
  expect(view.getByText('notes_title (1)')).toBeTruthy();

  await fireEvent.press(view.getByTestId('icon-star-outline'));
  await waitFor(() => expect(view.getByText('Characters (1)')).toBeTruthy());
  expect(view.queryByText('notes_title (1)')).toBeNull();
  expect(view.getByTestId('result-char-1')).toBeTruthy();
  expect(view.queryByTestId('result-char-2')).toBeNull();

  await fireEvent.press(view.getByTestId('icon-star'));
  await waitFor(() => expect(view.getByTestId('result-char-2')).toBeTruthy());
  expect(view.queryByTestId('result-char-1')).toBeNull();

  await fireEvent.press(view.getByTestId('icon-ban-outline'));
  await waitFor(() => expect(view.getByText('Characters (2)')).toBeTruthy());
});

it('clears results when the search fails', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockSearchAllEntities.mockRejectedValueOnce(new Error('boom'));
  const view = await render(<GlobalSearchScreen />);

  await typeQuery(view, 'ar');
  await waitFor(() => expect(view.getByText('global_search_no_results')).toBeTruthy());
  consoleSpy.mockRestore();
});

it('does not search without a story or a user', async () => {
  mockStory = null;
  const noStory = await render(<GlobalSearchScreen />);
  await typeQuery(noStory, 'aria');
  expect(mockSearchAllEntities).not.toHaveBeenCalled();

  mockStory = { id: 'story-1' };
  mockUserId = null;
  const noUser = await render(<GlobalSearchScreen />);
  await typeQuery(noUser, 'aria');
  expect(mockSearchAllEntities).not.toHaveBeenCalled();
});
