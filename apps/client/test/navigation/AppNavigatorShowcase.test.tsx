import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

/**
 * Showcase-mode coverage for AppNavigator.
 *
 * AppNavigator loads `../showcase/prepareShowcase` with a dynamic `import()`. Jest cannot run one, so the
 * test babel config turns it into a `require` (`babel/dynamicImportToRequire.js`) - which is also what lets
 * `jest.mock` replace the module here. These tests pin the flow: a showcase request skips the normal
 * settings flow, a prepared showcase opens straight into `MainSystem`, and any preparation failure
 * falls back to onboarding with an error log.
 */
const mockPrepareShowcase = jest.fn();

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
jest.mock('../../src/showcase/prepareShowcase', () => ({
  __esModule: true,
  prepareShowcase: (...args: unknown[]) => mockPrepareShowcase(...args),
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
  mockPrepareShowcase.mockRejectedValue(new Error('the capture window is gone'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

async function renderNavigator() {
  await render(<AppNavigator dbInitialized />);
  await waitFor(() => expect(mockScreens.some((entry) => entry.name === 'ColdInstall')).toBe(true));
  return mockRootNavigatorProps.at(-1);
}

it('opens straight into the system, on the story the showcase chose, once it is prepared', async () => {
  mockPrepareShowcase.mockResolvedValue(true);

  await render(<AppNavigator dbInitialized />);
  await waitFor(() => expect(mockRootNavigatorProps.length).toBeGreaterThan(0));

  expect(mockPrepareShowcase).toHaveBeenCalledWith(db, showcase);
  expect(mockRootNavigatorProps.at(-1)).toMatchObject({ initialRouteName: 'MainSystem' });
  expect(initializeTheme).toHaveBeenCalledWith(db);
});

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

  expect(console.error).toHaveBeenCalledWith(
    'Error checking for client settings:',
    expect.any(Error),
  );
});
