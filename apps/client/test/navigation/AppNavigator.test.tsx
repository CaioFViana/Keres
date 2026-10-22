import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import AppNavigator from '@/src/navigation/AppNavigator';
import { useDrizzle } from '@/src/db';
import { getClientSettings } from '@/src/services/account/ClientSettingsService';
import { useThemeStore } from '@/src/state/ui/themeStore';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { getAcceptedClientLegal } from '@/src/legal/clientTermsAcceptance';
import { logger } from '@/src/utils/logging/logger';
import { CLIENT_PRIVACY_VERSION } from '@/src/legal/privacyPolicy';
import { CLIENT_TERMS_VERSION } from '@/src/legal/clientTerms';

const mockScreens: Record<string, unknown>[] = [];
const mockRootNavigatorProps: Record<string, unknown>[] = [];

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
jest.mock('@/src/db', () => ({ __esModule: true, useDrizzle: jest.fn() }));
jest.mock('@/src/services/account/ClientSettingsService', () => ({
  __esModule: true,
  getClientSettings: jest.fn(),
}));
jest.mock('@/src/state/app/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: jest.fn(),
}));
jest.mock('@/src/state/ui/themeStore', () => ({
  __esModule: true,
  useThemeStore: jest.fn(),
}));
jest.mock('@/src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { background: '#101010' } }),
}));
jest.mock('@/src/components/features/app/SyncInitializer', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/src/navigation/stacks/ColdInstallStack', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/src/navigation/drawer/MainSystemDrawer', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/src/navigation/stacks/StorySelectionStack', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/src/screens/enter-stack/account/LegalUpdateScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/src/legal/clientTermsAcceptance', () => ({
  __esModule: true,
  getAcceptedClientLegal: jest.fn(),
}));

const db = { marker: 'db' };

/** The accepted records the navigator reads: a version per document, or null for never accepted. */
function acceptedLegal(versions: { terms: number | null; privacy: number | null }) {
  (getAcceptedClientLegal as jest.Mock).mockImplementation(async (document: string) => {
    const version = versions[document as 'terms' | 'privacy'];
    return version === null
      ? null
      : { version, acceptedAt: '2026-10-01T00:00:00.000Z', method: 'onboarding' };
  });
}
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
  // Both texts are agreed to in their current versions unless a test says otherwise.
  acceptedLegal({ terms: CLIENT_TERMS_VERSION, privacy: CLIENT_PRIVACY_VERSION });
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
    'LegalUpdate',
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

describe('legal texts on reopen', () => {
  it('opens the legal update when the accepted terms are an older version', async () => {
    acceptedLegal({ terms: CLIENT_TERMS_VERSION - 1, privacy: CLIENT_PRIVACY_VERSION });
    await renderNavigator();

    expect(rootNavigator()).toMatchObject({ initialRouteName: 'LegalUpdate' });
    expect(initializeSettings).toHaveBeenCalledWith(db);
  });

  it('opens the legal update when the privacy policy was never recorded', async () => {
    acceptedLegal({ terms: CLIENT_TERMS_VERSION, privacy: null });
    await renderNavigator();

    expect(rootNavigator()).toMatchObject({ initialRouteName: 'LegalUpdate' });
  });

  it('starts at story selection when both texts are at the current version', async () => {
    acceptedLegal({ terms: CLIENT_TERMS_VERSION, privacy: CLIENT_PRIVACY_VERSION });
    await renderNavigator();

    expect(rootNavigator()).toMatchObject({ initialRouteName: 'StorySelection' });
  });

  it('starts at story selection when the accepted versions are higher than the current ones', async () => {
    acceptedLegal({ terms: CLIENT_TERMS_VERSION + 1, privacy: CLIENT_PRIVACY_VERSION + 1 });
    await renderNavigator();

    expect(rootNavigator()).toMatchObject({ initialRouteName: 'StorySelection' });
  });

  it('starts at story selection when the records cannot be read', async () => {
    const failure = new Error('storage unavailable');
    const warned = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    (getAcceptedClientLegal as jest.Mock).mockRejectedValue(failure);
    await renderNavigator();

    expect(rootNavigator()).toMatchObject({ initialRouteName: 'StorySelection' });
    expect(console.error).not.toHaveBeenCalled();
    // Not asking again is a decision, and it leaves its reason behind.
    expect(warned).toHaveBeenCalledWith(
      'Could not read the accepted legal texts; not asking again now.',
      failure,
    );
  });

  it('does not check the legal records when no settings exist', async () => {
    (getClientSettings as jest.Mock).mockResolvedValueOnce(undefined);
    await renderNavigator();

    expect(getAcceptedClientLegal).not.toHaveBeenCalled();
    expect(rootNavigator()).toMatchObject({ initialRouteName: 'ColdInstall' });
  });
});
