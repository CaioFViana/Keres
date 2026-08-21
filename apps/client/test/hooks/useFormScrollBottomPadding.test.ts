/** @jest-environment node */
jest.mock('react-native-safe-area-context', () => ({
  __esModule: true,
  useSafeAreaInsets: jest.fn(),
}));

import { act, renderHook } from '@testing-library/react-native';
import { Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFormScrollBottomPadding } from '../../src/hooks/useFormScrollBottomPadding';

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
const originalOS = Platform.OS;
let screenHeight = 1000;
let windowHeight = 920;
let dimensionsListener: (() => void) | undefined;
const remove = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  screenHeight = 1000;
  windowHeight = 920;
  dimensionsListener = undefined;
  (useSafeAreaInsets as jest.Mock).mockReturnValue({ bottom: 0 });
  jest
    .spyOn(Dimensions, 'get')
    .mockImplementation(
      (dimension) => ({ height: dimension === 'screen' ? screenHeight : windowHeight }) as never,
    );
  jest.spyOn(Dimensions, 'addEventListener').mockImplementation((_event, listener) => {
    dimensionsListener = listener as () => void;
    return { remove } as never;
  });
});

afterEach(() => {
  setPlatform(originalOS);
  jest.restoreAllMocks();
});

it('uses the safe-area inset plus the caller margin on iOS', async () => {
  setPlatform('ios');
  (useSafeAreaInsets as jest.Mock).mockReturnValue({ bottom: 34 });
  const { result } = await renderHook(() => useFormScrollBottomPadding(16));

  expect(result.current).toBe(50);
  expect(Dimensions.addEventListener).not.toHaveBeenCalled();
});

it('uses the larger Android system-bar measurement and refreshes it on rotation', async () => {
  setPlatform('android');
  (useSafeAreaInsets as jest.Mock).mockReturnValue({ bottom: 24 });
  const { result, unmount } = await renderHook(() => useFormScrollBottomPadding());

  expect(result.current).toBe(104);

  windowHeight = 970;
  await act(async () => dimensionsListener?.());
  expect(result.current).toBe(54);

  await unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});

it('falls back to the Android safe-area inset when the display measurements have no gap', async () => {
  setPlatform('android');
  windowHeight = screenHeight;
  (useSafeAreaInsets as jest.Mock).mockReturnValue({ bottom: 18 });
  const { result } = await renderHook(() => useFormScrollBottomPadding(12));

  expect(result.current).toBe(30);
});
