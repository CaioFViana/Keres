import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockNotify = jest.fn();
const mockMarkInstalled = jest.fn();
const mockPreviewShippedPacks = jest.fn();
const mockInstallShippedPack = jest.fn();
const mockDb = {};
let mockLanguage = 'en';

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: () => undefined,
}));
jest.mock('@/src/components/common', () => ({
  __esModule: true,
  LanguageInstallRow: (props: {
    value: string;
    onValueChange: (value: string) => void;
    onInstall: () => void;
    installing: boolean;
    testID?: string;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      { testID: props.testID },
      react.createElement(native.Text, { testID: `${props.testID}-value` }, props.value ?? 'none'),
      react.createElement(
        native.Text,
        { testID: `${props.testID}-other`, onPress: () => props.onValueChange('pt') },
        'other',
      ),
      react.createElement(
        native.Text,
        { testID: `${props.testID}-btn`, onPress: props.onInstall },
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
jest.mock('../../../src/services/storymanagement/ShippedPackService', () => ({
  __esModule: true,
  createShippedPackService: () => ({
    previewShippedPacks: mockPreviewShippedPacks,
    installShippedPack: mockInstallShippedPack,
  }),
}));
jest.mock('../../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: (selector: (state: { showNotification: unknown }) => unknown) =>
    selector({ showNotification: mockNotify }),
}));
jest.mock('../../../src/state/shippedPacksInstallerStore', () => ({
  __esModule: true,
  useShippedPacksInstallerStore: (selector: (state: { markInstalled: unknown }) => unknown) =>
    selector({ markInstalled: mockMarkInstalled }),
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

import ShippedPacksContent from '../../../src/screens/packs/ShippedPacksContent';
import ShippedPacksScreen from '../../../src/screens/packs/ShippedPacksScreen';

const makePreview = (overrides = {}) => ({
  slug: 'fantasy',
  language: 'en',
  name: 'Fantasy Basics',
  description: 'Core fantasy fields',
  counts: {
    customAttributes: 2,
    suggestions: 1,
    tags: 0,
    stats: 4,
    hasVocabulary: false,
    extras: {
      chapters: 0,
      scenes: 0,
      characters: 0,
      locations: 0,
      worldRules: 0,
      notes: 0,
      storyBoards: 0,
      storyLocationMaps: 0,
    },
  },
  statSystem: true,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
  mockPreviewShippedPacks.mockReturnValue([]);
  mockInstallShippedPack.mockResolvedValue({ status: 'installed' });
});

afterEach(() => {
  cleanup();
});

it('shows the empty catalog state', async () => {
  const view = await render(<ShippedPacksScreen />);

  expect(view.getByText('shipped_packs_description')).toBeTruthy();
  expect(view.getByText('shipped_packs_empty')).toBeTruthy();
});

it('groups previews by slug with content chips', async () => {
  mockPreviewShippedPacks.mockReturnValue([
    makePreview(),
    makePreview({ language: 'pt', name: 'Fantasia Basica', description: null, statSystem: false }),
    makePreview({
      slug: 'scifi',
      language: 'en',
      name: 'Sci-Fi',
      description: null,
      statSystem: false,
      counts: {
        customAttributes: 0,
        suggestions: 0,
        tags: 0,
        stats: 0,
        hasVocabulary: true,
        extras: {
          chapters: 3,
          scenes: 0,
          characters: 0,
          locations: 0,
          worldRules: 0,
          notes: 0,
          storyBoards: 0,
          storyLocationMaps: 0,
        },
      },
    }),
  ]);
  const view = await render(<ShippedPacksScreen />);

  await waitFor(() => expect(view.getByText('Fantasy Basics')).toBeTruthy());
  expect(view.getByText('Sci-Fi')).toBeTruthy();
  expect(view.getByText('Core fantasy fields')).toBeTruthy();
  expect(view.getByText('packs_chip_attributes')).toBeTruthy();
  expect(view.getByText('packs_chip_vocabulary')).toBeTruthy();
  expect(view.getByText('packs_chip_chapters')).toBeTruthy();
  expect(view.getByText('shipped_packs_chip_stat_system')).toBeTruthy();
  expect(view.getByTestId('install-fantasy')).toBeTruthy();
  expect(view.getByTestId('install-scifi')).toBeTruthy();
});

it('follows the dropdown to the other language pack', async () => {
  mockPreviewShippedPacks.mockReturnValue([
    makePreview(),
    makePreview({ language: 'pt', name: 'Fantasia Basica' }),
  ]);
  const view = await render(<ShippedPacksScreen />);

  await waitFor(() => expect(view.getByText('Fantasy Basics')).toBeTruthy());
  await fireEvent.press(view.getByTestId('install-fantasy-other'));
  expect(view.getByText('Fantasia Basica')).toBeTruthy();
  expect(view.getByTestId('install-fantasy-value').props.children).toBe('pt');
});

it('installs the selected pack', async () => {
  mockPreviewShippedPacks.mockReturnValue([makePreview()]);
  mockInstallShippedPack.mockResolvedValue({ status: 'installed', packId: 'pack-1' });
  const view = await render(<ShippedPacksScreen />);

  await waitFor(() => expect(view.getByText('Fantasy Basics')).toBeTruthy());
  await fireEvent.press(view.getByTestId('install-fantasy-btn'));
  await waitFor(() => expect(mockInstallShippedPack).toHaveBeenCalledWith('fantasy', 'en'));
  expect(mockNotify).toHaveBeenCalledWith('shipped_packs_install_success', 'success');
  // The story form is not refocused by the overlay's modal, so it learns about the newcomer here.
  expect(mockMarkInstalled).toHaveBeenCalledWith('pack-1');
});

it('reports failed and throwing installs', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockPreviewShippedPacks.mockReturnValue([makePreview()]);
  mockInstallShippedPack.mockResolvedValueOnce({ status: 'failed' });
  const view = await render(<ShippedPacksScreen />);

  await waitFor(() => expect(view.getByText('Fantasy Basics')).toBeTruthy());
  await fireEvent.press(view.getByTestId('install-fantasy-btn'));
  await waitFor(() =>
    expect(mockNotify).toHaveBeenCalledWith('shipped_packs_install_failed', 'error'),
  );

  mockInstallShippedPack.mockRejectedValueOnce(new Error('boom'));
  await fireEvent.press(view.getByTestId('install-fantasy-btn'));
  await waitFor(() =>
    expect(mockNotify).toHaveBeenCalledWith('shipped_packs_install_failed', 'error'),
  );
  consoleSpy.mockRestore();
});

it('shows no close control when hosted as a plain screen', async () => {
  const view = await render(<ShippedPacksScreen />);

  await waitFor(() => expect(view.getByText('shipped_packs_description')).toBeTruthy());
  expect(view.queryByLabelText('close')).toBeNull();
});

it('shows a titled close control when hosted in the overlay', async () => {
  const onClose = jest.fn();
  const view = await render(<ShippedPacksContent onClose={onClose} showCloseButton />);

  await waitFor(() => expect(view.getByText('shipped_packs_title')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('close'));
  expect(onClose).toHaveBeenCalled();
});
