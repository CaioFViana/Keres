import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockNotify = jest.fn();
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

import ShippedPacksScreen from '../../../src/screens/packs/ShippedPacksScreen';

const makePreview = (overrides = {}) => ({
  slug: 'fantasy',
  language: 'en',
  name: 'Fantasy Basics',
  description: 'Core fantasy fields',
  counts: { customAttributes: 2, suggestions: 1, tags: 0, stats: 4, hasVocabulary: false },
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
      counts: { customAttributes: 0, suggestions: 0, tags: 0, stats: 0, hasVocabulary: true },
    }),
  ]);
  const view = await render(<ShippedPacksScreen />);

  await waitFor(() => expect(view.getByText('Fantasy Basics')).toBeTruthy());
  expect(view.getByText('Sci-Fi')).toBeTruthy();
  expect(view.getByText('Core fantasy fields')).toBeTruthy();
  expect(view.getByText('packs_chip_attributes')).toBeTruthy();
  expect(view.getByText('packs_chip_vocabulary')).toBeTruthy();
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
  const view = await render(<ShippedPacksScreen />);

  await waitFor(() => expect(view.getByText('Fantasy Basics')).toBeTruthy());
  await fireEvent.press(view.getByTestId('install-fantasy-btn'));
  await waitFor(() => expect(mockInstallShippedPack).toHaveBeenCalledWith('fantasy', 'en'));
  expect(mockNotify).toHaveBeenCalledWith('shipped_packs_install_success', 'success');
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
