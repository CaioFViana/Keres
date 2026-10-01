import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockNotify = jest.fn();
const mockFetchStoryList = jest.fn();
const mockListExampleStories = jest.fn();
const mockInstallExampleStory = jest.fn();
const mockCreateStoryService = jest.fn();
const mockDb = {};
let mockUserId: string | null = 'user-1';
let mockLanguage = 'en';
const mockUseScreenTour = jest.fn();

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('@expo/vector-icons', () => ({
  __esModule: true,
  Ionicons: ({ name }: { name: string }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: `icon-${name}` }, name);
  },
}));
jest.mock('../../../src/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
}));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: () => undefined,
}));
jest.mock('@/src/components/common', () => ({
  __esModule: true,
  LanguageInstallRow: (props: {
    options: { label: string; value: string }[];
    value: string;
    onValueChange: (value: string) => void;
    onInstall: () => void;
    installing: boolean;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      { testID: 'install-row' },
      react.createElement(native.Text, { testID: 'install-value' }, props.value ?? 'none'),
      react.createElement(
        native.Text,
        { testID: 'install-other', onPress: () => props.onValueChange('pt') },
        'other',
      ),
      react.createElement(
        native.Text,
        { testID: 'install-btn', onPress: props.onInstall },
        props.installing ? 'installing' : 'install',
      ),
    );
  },
}));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('@/src/hooks/useLanguageLabel', () => ({
  __esModule: true,
  useLanguageLabel: () => (language: string) => `label-${language}`,
}));
jest.mock('../../../src/services/storymanagement/ExampleStoryService', () => ({
  __esModule: true,
  createExampleStoryService: () => ({
    listExampleStories: mockListExampleStories,
    installExampleStory: mockInstallExampleStory,
  }),
}));
jest.mock('../../../src/services/storymanagement/StoryService', () => ({
  __esModule: true,
  createStoryService: (...args: unknown[]) => mockCreateStoryService(...args),
}));
jest.mock('../../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => ({ showNotification: mockNotify }),
}));
jest.mock('../../../src/state/storyListStore', () => ({
  __esModule: true,
  useStoryListStore: () => ({ fetchStories: mockFetchStoryList }),
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: mockUserId }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      primary: '#00f',
      surface: '#fafafa',
      text: '#111',
      textSecondary: '#666',
    },
  }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: mockLanguage } }),
}));

import ExampleStoriesScreen from '../../../src/screens/examplestories/ExampleStoriesScreen';

const makeEntry = (overrides = {}) => ({
  slug: 'tale',
  languages: [
    {
      language: 'en',
      story: {
        story: { title: 'The Tale', description: 'A tale', type: 'linear', author: 'Author' },
      },
    },
  ],
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = 'user-1';
  mockLanguage = 'en';
  mockListExampleStories.mockReturnValue([]);
  mockInstallExampleStory.mockResolvedValue({ status: 'installed' });
  mockCreateStoryService.mockReturnValue({});
});

afterEach(() => {
  cleanup();
});

it('shows the empty catalog state', async () => {
  const view = await render(<ExampleStoriesScreen />);

  expect(view.getByText('example_stories_description')).toBeTruthy();
  expect(view.getByText('example_stories_empty')).toBeTruthy();
});

it('requests its guided tour', async () => {
  await render(<ExampleStoriesScreen />);

  expect(mockUseScreenTour).toHaveBeenCalledWith('ExampleStories');
});

it('renders entry previews with the story type icon', async () => {
  mockListExampleStories.mockReturnValue([
    makeEntry(),
    makeEntry({
      slug: 'branch',
      languages: [
        {
          language: 'pt',
          story: {
            story: { title: '  ', description: 42, type: 'branching', author: '   ' },
          },
        },
      ],
    }),
  ]);
  const view = await render(<ExampleStoriesScreen />);

  await waitFor(() => expect(view.getByText('The Tale')).toBeTruthy());
  expect(view.getByText('A tale')).toBeTruthy();
  expect(view.getByText('example_stories_author')).toBeTruthy();
  // Blank titles and authors fall back; non-string descriptions are dropped.
  expect(view.getByText('branch')).toBeTruthy();
  expect(view.getByTestId('icon-git-branch-outline')).toBeTruthy();
  expect(view.getByTestId('icon-book-outline')).toBeTruthy();
});

it('skips entries without any language', async () => {
  mockListExampleStories.mockReturnValue([makeEntry({ slug: 'void', languages: [] })]);
  const view = await render(<ExampleStoriesScreen />);

  expect(view.queryByTestId('install-row')).toBeNull();
});

it('prefers the app language and installs the chosen one', async () => {
  mockListExampleStories.mockReturnValue([
    makeEntry({
      slug: 'tale',
      languages: [
        { language: 'en', story: { story: { title: 'The Tale' } } },
        { language: 'pt', story: { story: { title: 'O Conto' } } },
      ],
    }),
  ]);
  mockLanguage = 'pt';
  const view = await render(<ExampleStoriesScreen />);

  await waitFor(() => expect(view.getByText('O Conto')).toBeTruthy());
  expect(view.getByTestId('install-value').props.children).toBe('pt');

  await fireEvent.press(view.getByTestId('install-btn'));
  await waitFor(() => expect(mockInstallExampleStory).toHaveBeenCalledWith('user-1', 'tale', 'pt'));
  expect(mockNotify).toHaveBeenCalledWith('example_stories_install_success', 'success');
  expect(mockFetchStoryList).toHaveBeenCalled();
});

it('falls back to the first language and tracks dropdown changes', async () => {
  mockListExampleStories.mockReturnValue([
    makeEntry({
      languages: [
        { language: 'en', story: { story: { title: 'The Tale' } } },
        { language: 'pt', story: { story: { title: 'O Conto' } } },
      ],
    }),
  ]);
  mockLanguage = 'fr';
  const view = await render(<ExampleStoriesScreen />);

  await waitFor(() => expect(view.getByText('The Tale')).toBeTruthy());
  await fireEvent.press(view.getByTestId('install-other'));
  expect(view.getByTestId('install-value').props.children).toBe('pt');
});

it('refuses to install without a user', async () => {
  mockUserId = null;
  mockListExampleStories.mockReturnValue([makeEntry()]);
  const view = await render(<ExampleStoriesScreen />);

  await waitFor(() => expect(view.getByText('The Tale')).toBeTruthy());
  await fireEvent.press(view.getByTestId('install-btn'));
  expect(mockNotify).toHaveBeenCalledWith('user_not_identified', 'error');
  expect(mockInstallExampleStory).not.toHaveBeenCalled();
});

it('reports failed and throwing installs', async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  mockListExampleStories.mockReturnValue([makeEntry()]);
  mockInstallExampleStory.mockResolvedValueOnce({ status: 'failed' });
  const view = await render(<ExampleStoriesScreen />);

  await waitFor(() => expect(view.getByText('The Tale')).toBeTruthy());
  await fireEvent.press(view.getByTestId('install-btn'));
  await waitFor(() =>
    expect(mockNotify).toHaveBeenCalledWith('example_stories_install_failed', 'error'),
  );

  mockInstallExampleStory.mockRejectedValueOnce(new Error('boom'));
  await fireEvent.press(view.getByTestId('install-btn'));
  await waitFor(() =>
    expect(mockNotify).toHaveBeenCalledWith('example_stories_install_failed', 'error'),
  );
  consoleSpy.mockRestore();
});
