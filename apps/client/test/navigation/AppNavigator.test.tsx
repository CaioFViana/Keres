import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

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
import { useThemeStore } from '../../src/state/themeStore';
import { useUserSettingsStore } from '../../src/state/userSettingsStore';

const db = { marker: 'db' };
const initializeSettings = jest.fn();
const initializeTheme = jest.fn();

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
  (getClientSettings as jest.Mock).mockResolvedValue({ id: 'settings' });
  initializeSettings.mockResolvedValue(undefined);
  initializeTheme.mockResolvedValue(undefined);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

const rootNavigator = () => mockRootNavigatorProps.at(-1);

async function renderNavigator(dbInitialized = true) {
  const screen = await render(<AppNavigator dbInitialized={dbInitialized} />);
  await waitFor(() => expect(mockScreens.some((entry) => entry.name === 'ColdInstall')).toBe(true));
  return screen;
}

it('waits for the database before querying settings', async () => {
  await render(<AppNavigator dbInitialized={false} />);

  expect(getClientSettings).not.toHaveBeenCalled();
  expect(mockScreens).toEqual([]);
});

it('starts at story selection after initializing persisted user and theme settings', async () => {
  await renderNavigator();

  expect(getClientSettings).toHaveBeenCalledWith(db);
  expect(initializeSettings).toHaveBeenCalledWith(db);
  expect(initializeTheme).toHaveBeenCalledWith(db);
  expect(rootNavigator()).toMatchObject({ initialRouteName: 'StorySelection' });
  expect(mockScreens.map((screen) => screen.name)).toEqual([
    'ColdInstall',
    'StorySelection',
    'MainSystem',
  ]);
});

it('starts the onboarding flow when no persisted client settings exist', async () => {
  (getClientSettings as jest.Mock).mockResolvedValueOnce(undefined);
  await renderNavigator();

  expect(initializeSettings).not.toHaveBeenCalled();
  expect(initializeTheme).not.toHaveBeenCalled();
  expect(rootNavigator()).toMatchObject({ initialRouteName: 'ColdInstall' });
});

it('falls back to onboarding when the settings lookup fails', async () => {
  (getClientSettings as jest.Mock).mockRejectedValueOnce(new Error('database unavailable'));
  await renderNavigator();

  expect(rootNavigator()).toMatchObject({ initialRouteName: 'ColdInstall' });
  expect(console.error).toHaveBeenCalledWith(
    'Error checking for client settings:',
    expect.any(Error),
  );
});
