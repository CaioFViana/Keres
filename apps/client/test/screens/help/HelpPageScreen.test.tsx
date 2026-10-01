import { cleanup, fireEvent, render } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockPush = jest.fn();
const mockGoBack = jest.fn();
const mockDrawerNavigate = jest.fn();
const mockSetDocumentTitle = jest.fn();
const mockUseBackButtonHandler = jest.fn();
let mockParent: { navigate: (...args: unknown[]) => void } | null = null;
let mockRouteParams: { pageId: string; returnDrawerRoute?: string } = { pageId: 'p1' };
let mockResolved: { page?: unknown; usedFallback: boolean } = {
  page: undefined,
  usedFallback: false,
};

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => ({
      navigate: mockNavigate,
      push: mockPush,
      goBack: mockGoBack,
      getParent: () => mockParent,
    }),
    useRoute: () => ({ params: mockRouteParams }),
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('../../../src/components/features/help/HelpBlockRenderer/HelpBlockRenderer', () => ({
  __esModule: true,
  HelpBlockRenderer: (props: {
    block: { type: string; text?: string };
    onOpenPage: (pageId: string) => void;
    pageTitle: (pageId: string) => string;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      { testID: `block-${props.block.type}` },
      react.createElement(
        native.Text,
        { testID: 'block-open', onPress: () => props.onOpenPage('p2') },
        'open',
      ),
      react.createElement(native.Text, { testID: 'block-title-known' }, props.pageTitle('p2')),
      react.createElement(
        native.Text,
        { testID: 'block-title-missing' },
        props.pageTitle('missing'),
      ),
    );
  },
}));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: (...args: unknown[]) => mockUseBackButtonHandler(...args),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { background: '#fff', text: '#111', textSecondary: '#666' } }),
}));
jest.mock('../../../src/utils/documentTitle', () => ({
  __esModule: true,
  setDocumentTitle: (...args: unknown[]) => mockSetDocumentTitle(...args),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

import { HelpPageScreen } from '../../../src/screens/help/HelpPageScreen';
import type { DocLibrary } from '../../../src/help/library';

const pages = [
  {
    id: 'p1',
    title: 'Getting Started',
    summary: 'Begin here',
    keywords: [],
    blocks: [{ type: 'paragraph', text: 'Welcome' }],
  },
  { id: 'p2', title: 'Syncing', summary: 'Sync', keywords: [], blocks: [] },
];

const fakeLibrary = {
  id: 'help',
  sections: [],
  getPages: () => pages,
  getPage: (pageId: string) => pages.find((page) => page.id === pageId),
  resolvePage: () => mockResolved,
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
  emptyStateLinks: [],
} as unknown as DocLibrary;

beforeEach(() => {
  jest.clearAllMocks();
  mockParent = null;
  mockRouteParams = { pageId: 'p1' };
  mockResolved = { page: pages[0], usedFallback: false };
});

afterEach(() => {
  cleanup();
});

it('renders the page with its blocks', async () => {
  const view = await render(<HelpPageScreen library={fakeLibrary} />);

  expect(view.getByText('Getting Started')).toBeTruthy();
  expect(view.getByTestId('block-paragraph')).toBeTruthy();
  expect(view.queryByText('help_fallback')).toBeNull();
  expect(mockSetDocumentTitle).toHaveBeenCalledWith('Getting Started');

  await fireEvent.press(view.getByTestId('block-open'));
  expect(mockPush).toHaveBeenCalledWith('HelpPage', { pageId: 'p2' });
});

it('resolves block page titles with a fallback', async () => {
  const view = await render(<HelpPageScreen library={fakeLibrary} />);

  expect(view.getByTestId('block-title-known').props.children).toBe('Syncing');
  expect(view.getByTestId('block-title-missing').props.children).toBe('missing');
});

it('shows the fallback notice for translated pages', async () => {
  mockResolved = { page: pages[0], usedFallback: true };
  const view = await render(<HelpPageScreen library={fakeLibrary} />);

  expect(view.getByText('help_fallback')).toBeTruthy();
});

it('shows the not-found state for unknown pages', async () => {
  mockResolved = { page: undefined, usedFallback: false };
  const view = await render(<HelpPageScreen library={fakeLibrary} />);

  expect(view.getByText('help_not_found')).toBeTruthy();
  expect(mockSetDocumentTitle).toHaveBeenCalledWith('help_not_found');
});

it('restores the drawer route on back when recorded', async () => {
  mockParent = { navigate: mockDrawerNavigate };
  mockRouteParams = { pageId: 'p1', returnDrawerRoute: 'Stories' };
  await render(<HelpPageScreen library={fakeLibrary} />);

  const options = mockUseBackButtonHandler.mock.calls[0][0] as { onBack?: () => void };
  expect(typeof options.onBack).toBe('function');
  options.onBack!();
  expect(mockDrawerNavigate).toHaveBeenCalledWith('Stories');
  expect(mockGoBack).not.toHaveBeenCalled();
});

it('goes back without a drawer parent or recorded route', async () => {
  mockRouteParams = { pageId: 'p1', returnDrawerRoute: 'Stories' };
  await render(<HelpPageScreen library={fakeLibrary} />);
  const withoutParent = mockUseBackButtonHandler.mock.calls[0][0] as { onBack?: () => void };
  withoutParent.onBack!();
  expect(mockGoBack).toHaveBeenCalled();

  mockGoBack.mockClear();
  mockRouteParams = { pageId: 'p1' };
  await render(<HelpPageScreen library={fakeLibrary} />);
  const withoutRoute = mockUseBackButtonHandler.mock.calls[
    mockUseBackButtonHandler.mock.calls.length - 1
  ][0] as { onBack?: () => void };
  expect(withoutRoute.onBack).toBeUndefined();
});
