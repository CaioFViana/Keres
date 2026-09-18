import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

const mockNavigate = jest.fn();
const mockSetDocumentTitle = jest.fn();

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => ({ navigate: mockNavigate }),
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('../../../src/components/features/help/HelpSearchBar/HelpSearchBar', () => ({
  __esModule: true,
  HelpSearchBar: (props: {
    value: string;
    onChangeText: (value: string) => void;
    onClear: () => void;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      { testID: 'help-search-bar' },
      react.createElement(native.TextInput, {
        testID: 'help-search',
        value: props.value,
        onChangeText: props.onChangeText,
      }),
      react.createElement(native.Text, { testID: 'help-clear', onPress: props.onClear }, 'clear'),
    );
  },
}));
jest.mock('../../../src/components/features/help/HelpSearchBar/HighlightedText', () => ({
  __esModule: true,
  HighlightedText: ({ text }: { text: string }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'highlighted' }, text);
  },
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      primaryContainer: '#eef',
      surface: '#fafafa',
      text: '#111',
      textSecondary: '#666',
    },
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
jest.mock('../../../src/utils/documentTitle', () => ({
  __esModule: true,
  setDocumentTitle: (...args: unknown[]) => mockSetDocumentTitle(...args),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

import { HelpIndexScreen } from '../../../src/screens/help/HelpIndexScreen';
import type { DocLibrary } from '../../../src/help/library';

const pages = [
  {
    id: 'p1',
    title: 'Getting Started',
    summary: 'Begin here',
    keywords: ['start'],
    blocks: [{ type: 'paragraph', text: 'Welcome aboard' }],
  },
  {
    id: 'p2',
    title: 'Syncing',
    summary: 'Keep devices aligned',
    keywords: ['sync'],
    blocks: [{ type: 'paragraph', text: 'Sync keeps copies aligned' }],
  },
  {
    id: 'p3',
    title: 'Writing Tips',
    summary: 'Craft advice',
    keywords: ['craft'],
    blocks: [{ type: 'paragraph', text: 'Write every day' }],
  },
];

const fakeLibrary = {
  id: 'help',
  sections: [
    { id: 's1', titleKey: 'help_s1', icon: 'book', pageIds: ['p1', 'p2'] },
    { id: 's2', titleKey: 'help_s2', icon: 'star', pageIds: ['p3'] },
  ],
  getPages: () => pages,
  getPage: (pageId: string) => pages.find((page) => page.id === pageId),
  resolvePage: (pageId: string) => ({
    page: pages.find((page) => page.id === pageId),
    usedFallback: false,
  }),
  pageRouteName: 'HelpPage',
  indexTitleKey: 'help_index',
  titleKey: 'help_title',
  searchPlaceholderKey: 'help_search',
  searchClearKey: 'help_clear',
  searchResultsCountKey: 'help_count',
  noResultsKey: 'help_no_results',
  notFoundKey: 'help_not_found',
  fallbackNoticeKey: 'help_fallback',
  defaultOpenSectionId: 's1',
  emptyStateLinks: [{ pageId: 'p1', labelKey: 'help_go_p1' }],
} as unknown as DocLibrary;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

it('renders sections with the default one open', async () => {
  const view = await render(<HelpIndexScreen library={fakeLibrary} />);

  expect(view.getByText('help_s1')).toBeTruthy();
  expect(view.getByText('help_s2')).toBeTruthy();
  expect(view.getByText('Getting Started')).toBeTruthy();
  expect(view.queryByText('Writing Tips')).toBeNull();
  expect(mockSetDocumentTitle).toHaveBeenCalledWith('help_index');
});

it('toggles sections open and closed', async () => {
  const view = await render(<HelpIndexScreen library={fakeLibrary} />);

  await fireEvent.press(view.getByText('help_s2'));
  expect(view.getByText('Writing Tips')).toBeTruthy();

  await fireEvent.press(view.getByText('help_s1'));
  expect(view.queryByText('Getting Started')).toBeNull();
});

it('opens a page on press', async () => {
  const view = await render(<HelpIndexScreen library={fakeLibrary} />);

  await fireEvent.press(view.getByText('Getting Started'));
  expect(mockNavigate).toHaveBeenCalledWith('HelpPage', { pageId: 'p1' });
});

it('honours controlled open sections', async () => {
  const onOpenSectionsChange = jest.fn();
  const view = await render(
    <HelpIndexScreen
      library={fakeLibrary}
      openSections={{}}
      onOpenSectionsChange={onOpenSectionsChange}
    />,
  );

  expect(view.queryByText('Getting Started')).toBeNull();
  await fireEvent.press(view.getByText('help_s1'));
  expect(onOpenSectionsChange).toHaveBeenCalled();
});

it('searches pages and opens a result', async () => {
  const view = await render(<HelpIndexScreen library={fakeLibrary} />);

  await fireEvent.changeText(view.getByTestId('help-search'), 'sync');
  expect(view.getByText('help_count')).toBeTruthy();
  expect(view.getByText('Syncing')).toBeTruthy();
  expect(view.queryByText('Getting Started')).toBeNull();
  expect(view.getByTestId('highlighted')).toBeTruthy();

  await fireEvent.press(view.getByText('Syncing'));
  expect(mockNavigate).toHaveBeenCalledWith('HelpPage', { pageId: 'p2' });
});

it('shows empty state links without results', async () => {
  const view = await render(<HelpIndexScreen library={fakeLibrary} />);

  await fireEvent.changeText(view.getByTestId('help-search'), 'zzz-no-match');
  expect(view.getByText('help_no_results')).toBeTruthy();
  await fireEvent.press(view.getByText('help_go_p1'));
  expect(mockNavigate).toHaveBeenCalledWith('HelpPage', { pageId: 'p1' });
});

it('clears the search back to sections', async () => {
  const view = await render(<HelpIndexScreen library={fakeLibrary} />);

  await fireEvent.changeText(view.getByTestId('help-search'), 'sync');
  expect(view.queryByText('Getting Started')).toBeNull();
  await fireEvent.press(view.getByTestId('help-clear'));
  expect(view.getByText('Getting Started')).toBeTruthy();
});
