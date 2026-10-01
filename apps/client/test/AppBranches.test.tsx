import { cleanup, render, waitFor } from '@testing-library/react-native';
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
jest.mock('expo-status-bar', () => ({ __esModule: true, StatusBar: jest.fn(() => null) }));
jest.mock('expo-navigation-bar', () => ({ __esModule: true, NavigationBar: jest.fn(() => null) }));
jest.mock('expo-system-ui', () => ({
  __esModule: true,
  setBackgroundColorAsync: jest.fn(),
}));
jest.mock('@react-navigation/native', () => {
  return {
    __esModule: true,
    DefaultTheme: {
      dark: false,
      colors: {
        primary: 'd',
        background: 'd',
        card: 'd',
        text: 'd',
        border: 'd',
        notification: 'd',
      },
    },
    ThemeProvider: jest.fn(({ children }: { children: React.ReactNode }) => <>{children}</>),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  __esModule: true,
  useSafeAreaInsets: jest.fn(),
  // React.ReactNode resolves via the UMD global type; the factory's JSX uses the automatic
  // runtime, so no react import is needed here.
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('../src/db', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
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
jest.mock('../src/services/HostedCookieSession', () => ({
  __esModule: true,
  restoreHostedCookieSession: jest.fn(),
}));
jest.mock('../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: jest.fn(),
}));
jest.mock('../src/testing/sqliteWebSmokeProbe', () => ({
  __esModule: true,
  runSqliteWebSmokeProbe: jest.fn(),
  shouldRunSqliteWebSmokeProbe: false,
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
jest.mock('../src/navigation/AppNavigator', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => React.createElement(View, { testID: 'app-navigator' }),
  };
});
jest.mock('@/src/components/common/feedback/AppAlertHost/AppAlertHost', () => () => null);
jest.mock('@/src/components/common/feedback/NotificationPopup/NotificationPopup', () => () => null);
jest.mock('@/src/components/features/app/DocumentTitleSync', () => () => null);
jest.mock('@/src/components/features/app/WebScrollbarTheme', () => () => null);
jest.mock('@/src/components/features/export/SvgRasterHost', () => () => null);

import { useSQLiteContext } from 'expo-sqlite';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import App from '../src/App';
import { initializeDrizzle, useDrizzle } from '../src/db';
import { migrate } from '../src/db/migrate';
import { authTokenManager } from '../src/services/AuthTokenManager';
import { restoreHostedCookieSession } from '../src/services/HostedCookieSession';
import { useUserSettingsStore } from '../src/state/userSettingsStore';
import { useTheme } from '../src/theme';
import { isColorLight } from '../src/theme/commonStyles';
import i18n from '../src/utils/i18n';

const db = { name: 'sqlite' };
const drizzle = { name: 'drizzle' };
const initializeSettings = jest.fn();
const palette = {
  primary: '#0000ff',
  background: '#ffffff',
  surface: '#f0f0f0',
  text: '#111111',
  border: '#cccccc',
  notification: '#ff0000',
};

beforeEach(() => {
  jest.clearAllMocks();
  (useSQLiteContext as jest.Mock).mockReturnValue(db);
  (initializeDrizzle as jest.Mock).mockReturnValue(drizzle);
  (migrate as jest.Mock).mockResolvedValue(undefined);
  (authTokenManager.hydrateTokens as jest.Mock).mockResolvedValue(undefined);
  (restoreHostedCookieSession as jest.Mock).mockResolvedValue(null);
  initializeSettings.mockResolvedValue({ language: null });
  (useUserSettingsStore as unknown as jest.Mock).mockImplementation((selector) =>
    selector({ initializeSettings }),
  );
  (useDrizzle as jest.Mock).mockReturnValue(drizzle);
  (useSafeAreaInsets as jest.Mock).mockReturnValue({ top: 10, bottom: 20 });
  (useTheme as jest.Mock).mockReturnValue({ colors: palette, isDarkMode: false });
  (isColorLight as jest.Mock).mockReturnValue(true);
  (SystemUI.setBackgroundColorAsync as jest.Mock).mockResolvedValue(undefined);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it('renders without applying a language when settings carry none', async () => {
  const screen = await render(<App />);

  await waitFor(() => expect(screen.getByTestId('app-navigator')).toBeTruthy());

  expect(i18n.changeLanguage).not.toHaveBeenCalled();
});

it('falls back to a hardcoded loading label when the translation is empty', async () => {
  let finishMigration: (() => void) | undefined;
  (migrate as jest.Mock).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishMigration = resolve;
      }),
  );
  (i18n.t as unknown as jest.Mock).mockReturnValueOnce('');
  const screen = await render(<App />);

  expect(screen.getByText('Loading...')).toBeTruthy();
  finishMigration?.();
  await waitFor(() => expect(screen.getByTestId('app-navigator')).toBeTruthy());
});

it.each([
  [true, 'dark'],
  [false, 'light'],
])('uses a %s status bar when the background is light=%s', async (light, style) => {
  (isColorLight as jest.Mock).mockReturnValue(light);
  const screen = await render(<App />);

  await waitFor(() => expect(screen.getByTestId('app-navigator')).toBeTruthy());

  expect(isColorLight).toHaveBeenCalledWith(palette.background);
  expect(StatusBar).toHaveBeenCalledWith(expect.objectContaining({ style }), undefined);
});

it.each([
  [true, 'dark'],
  [false, 'light'],
])(
  "tints Android's system buttons from the palette (light=%s -> %s), not the phone's scheme",
  async (light, style) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- platform switch for one case.
    const { Platform } = require('react-native');
    const original = Platform.OS;
    Platform.OS = 'android';
    try {
      (isColorLight as jest.Mock).mockReturnValue(light);
      const screen = await render(<App />);
      await waitFor(() => expect(screen.getByTestId('app-navigator')).toBeTruthy());

      expect(NavigationBar).toHaveBeenCalledWith(expect.objectContaining({ style }), undefined);
    } finally {
      Platform.OS = original;
    }
  },
);

it('leaves the navigation bar alone off Android', async () => {
  const screen = await render(<App />);
  await waitFor(() => expect(screen.getByTestId('app-navigator')).toBeTruthy());

  expect(NavigationBar).not.toHaveBeenCalled();
});

describe('the web page lifecycle', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- platform switch for these cases.
  const { Platform } = require('react-native');
  const original = Platform.OS;
  const listeners = new Map<string, (event: unknown) => void>();
  const target = globalThis as unknown as Record<string, unknown>;
  const saved = {
    add: target.addEventListener,
    remove: target.removeEventListener,
    location: target.location,
  };
  const reload = jest.fn();

  beforeEach(() => {
    Platform.OS = 'web';
    process.env.EXPO_PUBLIC_SERVERLESS = '1';
    listeners.clear();
    target.addEventListener = (name: string, handler: (event: unknown) => void) =>
      void listeners.set(name, handler);
    target.removeEventListener = (name: string) => void listeners.delete(name);
    target.location = { reload };
  });

  afterEach(async () => {
    // Unmounting removes the listeners: it must happen while the stand-ins are still in place.
    await cleanup();
    delete process.env.EXPO_PUBLIC_SERVERLESS;
    Platform.OS = original;
    target.addEventListener = saved.add;
    target.removeEventListener = saved.remove;
    target.location = saved.location;
  });

  it('keeps the page out of the back/forward cache, so leaving it releases the database file', async () => {
    await render(<App />);

    expect(listeners.has('unload')).toBe(true);
  });

  it('starts over when the page comes back from that cache anyway', async () => {
    await render(<App />);

    listeners.get('pageshow')?.({ persisted: false });
    expect(reload).not.toHaveBeenCalled();
    listeners.get('pageshow')?.({ persisted: true });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('is left alone outside the serverless build: the hosted and desktop web clients keep the cache', async () => {
    delete process.env.EXPO_PUBLIC_SERVERLESS;
    await render(<App />);

    expect(listeners.size).toBe(0);
  });

  it('is left alone on a phone', async () => {
    Platform.OS = 'android';
    await render(<App />);

    expect(listeners.size).toBe(0);
  });
});

it('keeps the native window background in sync with the palette', async () => {
  const screen = await render(<App />);

  await waitFor(() => expect(screen.getByTestId('app-navigator')).toBeTruthy());

  expect(SystemUI.setBackgroundColorAsync).toHaveBeenCalledWith(palette.background);
});

it('survives a native background-sync failure', async () => {
  (SystemUI.setBackgroundColorAsync as jest.Mock).mockRejectedValueOnce(new Error('no window'));
  const screen = await render(<App />);

  await waitFor(() => expect(screen.getByTestId('app-navigator')).toBeTruthy());
});
