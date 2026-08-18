import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

jest.mock('expo-sqlite', () => ({
  __esModule: true,
  SQLiteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSQLiteContext: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  I18nextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('expo-status-bar', () => ({ __esModule: true, StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  __esModule: true,
  useSafeAreaInsets: jest.fn(),
}));
jest.mock('../src/db', () => {
  const React = require('react');
  return {
    __esModule: true,
    DrizzleContext: React.createContext(null),
    initializeDrizzle: jest.fn(),
    useDrizzle: jest.fn(),
  };
});
jest.mock('../src/db/migrate', () => ({ __esModule: true, migrate: jest.fn() }));
jest.mock('../src/services/AuthTokenManager', () => ({
  __esModule: true,
  authTokenManager: { hydrateTokens: jest.fn() },
  setAuthDb: jest.fn(),
}));
jest.mock('../src/services/apiClient', () => ({
  __esModule: true,
  default: { setTokenProvider: jest.fn() },
}));
jest.mock('../src/services/webMediaStore', () => ({ __esModule: true, hydrate: jest.fn() }));
jest.mock('../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: jest.fn(),
}));
jest.mock('../src/testing/sqliteWebSmokeProbe', () => ({
  __esModule: true,
  runSqliteWebSmokeProbe: jest.fn(),
  shouldRunSqliteWebSmokeProbe: true,
}));
jest.mock('../src/theme', () => ({
  __esModule: true,
  useTheme: jest.fn(),
}));
jest.mock('../src/theme/commonStyles', () => ({ __esModule: true, isColorLight: jest.fn() }));
jest.mock('../src/theme/ThemeProvider', () => ({
  __esModule: true,
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('../src/utils/i18n', () => ({
  __esModule: true,
  default: { t: jest.fn((key: string) => key), changeLanguage: jest.fn() },
}));
jest.mock('../src/navigation/AppNavigator', () => ({
  __esModule: true,
  default: ({ dbInitialized }: { dbInitialized: boolean }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, {
      testID: 'app-navigator',
      accessibilityLabel: String(dbInitialized),
    });
  },
}));

jest.mock('@/src/components/common/feedback/AppAlertHost/AppAlertHost', () => () => null);
jest.mock('@/src/components/common/feedback/NotificationPopup/NotificationPopup', () => () => null);
jest.mock('@/src/components/features/app/DocumentTitleSync', () => () => null);
jest.mock('@/src/components/features/app/WebScrollbarTheme', () => () => null);

import { useSQLiteContext } from 'expo-sqlite';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import App from '../src/App';
import { initializeDrizzle, useDrizzle } from '../src/db';
import { migrate } from '../src/db/migrate';
import apiClient from '../src/services/apiClient';
import { authTokenManager, setAuthDb } from '../src/services/AuthTokenManager';
import { hydrate as hydrateWebMediaStore } from '../src/services/webMediaStore';
import { useUserSettingsStore } from '../src/state/userSettingsStore';
import { runSqliteWebSmokeProbe } from '../src/testing/sqliteWebSmokeProbe';
import { useTheme } from '../src/theme';
import i18n from '../src/utils/i18n';

const db = { name: 'sqlite' };
const drizzle = { name: 'drizzle' };
const initializeSettings = jest.fn();
const setPlatform = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('ios');
  (useSQLiteContext as jest.Mock).mockReturnValue(db);
  (initializeDrizzle as jest.Mock).mockReturnValue(drizzle);
  (migrate as jest.Mock).mockResolvedValue(undefined);
  (authTokenManager.hydrateTokens as jest.Mock).mockResolvedValue(undefined);
  initializeSettings.mockResolvedValue({ language: 'pt-BR' });
  (useUserSettingsStore as unknown as jest.Mock).mockImplementation((selector) =>
    selector({ initializeSettings }),
  );
  (useDrizzle as jest.Mock).mockReturnValue(drizzle);
  (useSafeAreaInsets as jest.Mock).mockReturnValue({ top: 0, bottom: 0 });
  (useTheme as jest.Mock).mockReturnValue({ colors: { background: '#fff' } });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  setPlatform(originalOS);
  jest.restoreAllMocks();
});

it('initializes SQLite, authentication, settings and navigation in order', async () => {
  let finishMigration: (() => void) | undefined;
  (migrate as jest.Mock).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishMigration = resolve;
      }),
  );
  const screen = await render(<App />);

  expect(screen.getByText('loading_application')).toBeTruthy();
  finishMigration?.();
  await waitFor(() => expect(screen.getByTestId('app-navigator')).toBeTruthy());

  expect(migrate).toHaveBeenCalledWith(db);
  expect(initializeDrizzle).toHaveBeenCalledWith(db);
  expect(setAuthDb).toHaveBeenCalledWith(drizzle);
  expect(authTokenManager.hydrateTokens).toHaveBeenCalledTimes(1);
  expect(apiClient.setTokenProvider).toHaveBeenCalledWith(authTokenManager);
  expect(initializeSettings).toHaveBeenCalledWith(drizzle);
  expect(i18n.changeLanguage).toHaveBeenCalledWith('pt-BR');
  expect(screen.getByTestId('app-navigator').props.accessibilityLabel).toBe('true');
});

it('hydrates desktop media and runs the SQLite smoke probe before using a web database', async () => {
  setPlatform('web');
  const screen = await render(<App />);

  await waitFor(() => expect(screen.getByTestId('app-navigator')).toBeTruthy());

  expect(hydrateWebMediaStore).toHaveBeenCalledTimes(1);
  expect(runSqliteWebSmokeProbe).toHaveBeenCalledWith(db);
  expect(migrate).toHaveBeenCalledWith(db);
});

it('keeps the loading screen and stops downstream setup when migration fails', async () => {
  (migrate as jest.Mock).mockRejectedValueOnce(new Error('migration failed'));
  const screen = await render(<App />);

  await waitFor(() => expect(migrate).toHaveBeenCalledWith(db));

  expect(screen.getByText('loading_application')).toBeTruthy();
  expect(screen.queryByTestId('app-navigator')).toBeNull();
  expect(initializeDrizzle).not.toHaveBeenCalled();
  expect(initializeSettings).not.toHaveBeenCalled();
});

it('waits without starting initialization until SQLite context becomes available', async () => {
  (useSQLiteContext as jest.Mock).mockReturnValue(null);
  const screen = await render(<App />);

  expect(screen.getByText('loading_application')).toBeTruthy();
  expect(migrate).not.toHaveBeenCalled();
});
