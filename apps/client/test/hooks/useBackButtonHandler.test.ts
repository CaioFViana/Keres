/** @jest-environment node */
const mockNavigation = {
  canGoBack: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(),
  getState: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => mockNavigation,
  useFocusEffect: (effect: () => void) => effect(),
}));
jest.mock('../../src/hooks/useResponsiveLayout', () => ({
  __esModule: true,
  useResponsiveLayout: jest.fn(),
}));
jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { text: '#111' } }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: (selector: (state: { showContextualHelp: boolean }) => unknown) =>
    selector({ showContextualHelp: true }),
}));
jest.mock(
  '../../src/components/common/navigation/NavigationBackButton/NavigationBackButton',
  () => 'NavigationBackButton',
);
jest.mock(
  '../../src/components/common/navigation/NavigationDrawerButton/NavigationDrawerButton',
  () => 'NavigationDrawerButton',
);

import { renderHook } from '@testing-library/react-native';
import { BackHandler, Platform } from 'react-native';
import { useBackButtonHandler } from '../../src/hooks/useBackButtonHandler';
import { useResponsiveLayout } from '../../src/hooks/useResponsiveLayout';
import { useHeaderBackActionStore } from '../../src/state/headerBackActionStore';

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
const originalOS = Platform.OS;
let hardwareBack: (() => boolean) | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('android');
  mockNavigation.canGoBack.mockReturnValue(false);
  mockNavigation.getParent.mockReturnValue(undefined);
  mockNavigation.getState.mockReturnValue({ type: 'stack' });
  useHeaderBackActionStore.setState({ backAction: undefined });
  (useResponsiveLayout as jest.Mock).mockReturnValue({ isWide: false });
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, listener) => {
    hardwareBack = () => listener() === true;
    return { remove: jest.fn() };
  });
});

afterEach(() => {
  setPlatform(originalOS);
  jest.restoreAllMocks();
});

it('handles a hardware back press inside the current stack first', async () => {
  mockNavigation.canGoBack.mockReturnValue(true);
  await renderHook(() => useBackButtonHandler());

  expect(hardwareBack?.()).toBe(true);
  expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
});

it('delegates to a parent navigator only when the current stack is at its root', async () => {
  const parent = { canGoBack: jest.fn(() => true), goBack: jest.fn() };
  mockNavigation.getParent.mockReturnValue(parent);
  await renderHook(() => useBackButtonHandler());

  expect(hardwareBack?.()).toBe(true);
  expect(parent.goBack).toHaveBeenCalledTimes(1);
});

it('lets the app exit handler receive back presses with nowhere to go', async () => {
  await renderHook(() => useBackButtonHandler());

  expect(hardwareBack?.()).toBe(false);
});

it('preserves the drawer header on web screens without a custom back button', async () => {
  const drawer = {
    getState: jest.fn(() => ({ type: 'drawer' })),
    getParent: jest.fn(),
    setOptions: jest.fn(),
  };
  setPlatform('web');
  mockNavigation.getParent.mockReturnValue(drawer);

  await renderHook(() => useBackButtonHandler());

  expect(drawer.setOptions).not.toHaveBeenCalled();
});

it('registers the focused child navigator as the header back action', async () => {
  await renderHook(() => useBackButtonHandler({ showWebBackButton: true }));

  useHeaderBackActionStore.getState().backAction?.();

  expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
});
