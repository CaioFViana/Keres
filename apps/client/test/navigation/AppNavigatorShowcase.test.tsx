import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

/**
 * Showcase-mode coverage for AppNavigator.
 *
 * NOTE: AppNavigator loads `../showcase/prepareShowcase` with a dynamic `import()`, which the
 * babel preset leaves untransformed; under jest that always rejects (a cross-realm TypeError),
 * so the ready-path (opening straight into `MainSystem`) cannot be exercised here and a
 * `jest.mock` of `prepareShowcase` could never take effect. These tests pin what is observable:
 * a showcase request skips the normal settings flow, and any preparation failure falls back to
 * onboarding with an error log.
 */

const mockScreens: Array<Record<string, unknown>> = [];
const mockRootNavigatorProps: Array<Record<string, unknown>> = [];

jest.mock('@react-navigation/native-stack', () => ({
  __esModule: true,
  createNativeStackNavigator: () => ({
    Navigator: ({ children, ...props }: { children: React.ReactNode }) => {
      mockRootNavigatorProps.push(props);
      return <>{children}</>;
    },
    Screen: (props: Record<string, unknown>) => {
      mockScreens.push(props);
      return null;
    },
  }),
}));
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn() }));
jest.mock('../../src/services/ClientSettingsService', () => ({
  __esModule: true,
  getClientSettings: jest.fn(),
}));
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: jest.fn(),
}));
jest.mock('../../src/state/themeStore', () => ({
  __esModule: true,
  useThemeStore: jest.fn(),
}));
jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { background: '#101010' } }),
}));
jest.mock('../../src/showcase/showcaseRequest', () => ({
  __esModule: true,
  readShowcaseRequest: jest.fn(),
}));
jest.mock('@/src/components/features/app/SyncInitializer', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('../../src/navigation/ColdInstallStack', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/navigation/MainSystemStack', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/navigation/StorySelectionStack', () => ({
  __esModule: true,
  default: () => null,
}));

import AppNavigator from '../../src/navigation/AppNavigator';
import { useDrizzle } from '../../src/db';
import { getClientSettings } from '../../src/services/ClientSettingsService';
import { readShowcaseRequest } from '../../src/showcase/showcaseRequest';
import { useThemeStore } from '../../src/state/themeStore';
import { useUserSettingsStore } from '../../src/state/userSettingsStore';

const db = { marker: 'db' };
const initializeSettings = jest.fn();
const initializeTheme = jest.fn();
const showcase = { story: 'alice', stack: 'PlotsStack', theme: 'light', language: 'en' };

beforeEach(() => {
  jest.clearAllMocks();
  mockScreens.length = 0;
  mockRootNavigatorProps.length = 0;
  (useDrizzle as jest.Mock).mockReturnValue(db);
  (useUserSettingsStore as unknown as jest.Mock).mockImplementation((selector) =>
    selector({ initializeSettings }),
  );
  (useThemeStore as unknown as jest.Mock).mockImplementation((selector) =>
    selector({ initializeTheme }),
  );
  (readShowcaseRequest as jest.Mock).mockReturnValue(showcase);
  initializeSettings.mockResolvedValue(undefined);
  initializeTheme.mockResolvedValue(undefined);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

async function renderNavigator() {
  await render(<AppNavigator dbInitialized />);
  await waitFor(() => expect(mockScreens.some((entry) => entry.name === 'ColdInstall')).toBe(true));
  return mockRootNavigatorProps.at(-1);
}

it('skips the settings lookup and user-settings init when a showcase is requested', async () => {
  await renderNavigator();

  // The showcase creates its own settings; the welcome flow never runs.
  expect(getClientSettings).not.toHaveBeenCalled();
  expect(initializeSettings).not.toHaveBeenCalled();
});

it('falls back to onboarding when showcase preparation fails', async () => {
  const navigator = await renderNavigator();

  expect(navigator).toMatchObject({ initialRouteName: 'ColdInstall' });
});

it('logs showcase preparation failures', async () => {
  await renderNavigator();

  // `expect.any(Error)` cannot match here: the rejection is a cross-realm TypeError, so
  // `instanceof` fails. Any thrown value logged alongside the message is the contract.
  expect(console.error).toHaveBeenCalledWith(
    'Error checking for client settings:',
    expect.anything(),
  );
});
