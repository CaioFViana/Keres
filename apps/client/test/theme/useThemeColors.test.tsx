import { render } from '@testing-library/react-native';
import { themes } from '@keres/shared';
import { Text } from 'react-native';

jest.mock('../../src/state/themeStore', () => ({
  __esModule: true,
  useThemeStore: jest.fn(),
}));

import { useThemeStore } from '../../src/state/themeStore';
import { useThemeColors } from '../../src/theme/useThemeColors';

const storeState = { darkMode: false };

function renderColors(themeName: string | null | undefined) {
  const Probe = () => {
    const colors = useThemeColors(themeName);
    return <Text testID="bg">{colors.background}</Text>;
  };
  return render(<Probe />);
}

beforeEach(() => {
  jest.clearAllMocks();
  storeState.darkMode = false;
  // useThemeColors calls `useThemeStore()` with no selector; return the whole state then.
  (useThemeStore as unknown as jest.Mock).mockImplementation((selector?: any) =>
    typeof selector === 'function' ? selector(storeState) : storeState,
  );
});

it('returns the requested palette in light mode', async () => {
  const screen = await renderColors('ocean');
  expect(screen.getByTestId('bg').props.children).toBe(themes.ocean.lightColors.background);
});

it('returns the dark variant when the store is in dark mode', async () => {
  storeState.darkMode = true;
  const screen = await renderColors('ocean');
  expect(screen.getByTestId('bg').props.children).toBe(themes.ocean.darkColors.background);
});

it.each([null, undefined, '', 'no-such-theme'])('falls back to default for %p', async (name) => {
  const screen = await renderColors(name);
  expect(screen.getByTestId('bg').props.children).toBe(themes.default.lightColors.background);
});
