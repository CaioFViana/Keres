import { act, render } from '@testing-library/react-native';
import { themes } from '@keres/shared';
import React from 'react';
import { Text } from 'react-native';

jest.mock('../../src/state/themeStore', () => ({
  __esModule: true,
  useThemeStore: jest.fn(),
}));

import { useThemeStore } from '../../src/state/themeStore';
import { useTheme } from '../../src/theme/ThemeContext';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

const storeState = { darkMode: false, toggleDarkMode: jest.fn() };
const db = { marker: 'drizzle' };

async function renderWithTheme(props: { defaultThemeName?: string; drizzleClient?: any } = {}) {
  const Probe = () => {
    const theme = useTheme();
    return (
      <Text testID="probe">{`${theme.currentThemeName}:${theme.isDarkMode}:${theme.colors.background}`}</Text>
    );
  };
  let captured: ReturnType<typeof useTheme> | undefined;
  const Capture = () => {
    captured = useTheme();
    return null;
  };
  const screen = await render(
    <ThemeProvider
      defaultThemeName={props.defaultThemeName}
      drizzleClient={props.drizzleClient === undefined ? (db as any) : props.drizzleClient}
    >
      <Probe />
      <Capture />
    </ThemeProvider>,
  );
  return {
    screen,
    captured: () => captured as ReturnType<typeof useTheme>,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  storeState.darkMode = false;
  // ThemeProvider calls `useThemeStore()` with no selector; return the whole state then.
  (useThemeStore as unknown as jest.Mock).mockImplementation((selector?: any) =>
    typeof selector === 'function' ? selector(storeState) : storeState,
  );
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it('provides the default light palette', async () => {
  const { screen } = await renderWithTheme();
  expect(screen.getByTestId('probe').props.children).toBe(
    `default:false:${themes.default.lightColors.background}`,
  );
});

it('provides the dark palette when the store is in dark mode', async () => {
  storeState.darkMode = true;
  const { screen } = await renderWithTheme();
  expect(screen.getByTestId('probe').props.children).toBe(
    `default:true:${themes.default.darkColors.background}`,
  );
});

it('switches palettes with setTheme and falls back on unknown names', async () => {
  const { captured, screen } = await renderWithTheme();
  // RNTL's `act` is always async: it must be awaited or updates never flush.
  await act(async () => captured().setTheme('ocean'));
  expect(screen.getByTestId('probe').props.children).toContain('ocean:');
  await act(async () => captured().setTheme('no-such-theme'));
  expect(screen.getByTestId('probe').props.children).toContain('default:');
  expect(console.warn).toHaveBeenCalledWith(
    'Theme "no-such-theme" not found. Falling back to default theme.',
  );
});

it('delegates toggling to the store when a database is available', async () => {
  const { captured } = await renderWithTheme();
  captured().toggleTheme();
  expect(storeState.toggleDarkMode).toHaveBeenCalledWith(db);
  expect(console.warn).not.toHaveBeenCalled();
});

it('warns instead of toggling without a database', async () => {
  const { captured } = await renderWithTheme({ drizzleClient: null });
  captured().toggleTheme();
  expect(storeState.toggleDarkMode).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledWith('Drizzle client not available for theme toggling.');
});
