/** @jest-environment node */
jest.mock('../../src/services/webMediaStore', () => ({
  __esModule: true,
  DESKTOP_MEDIA_URI_PREFIX: 'desktop-media:',
  resolveBlobUri: jest.fn(),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useResolvedMediaUri } from '../../src/hooks/useResolvedMediaUri';
import { resolveBlobUri } from '../../src/services/webMediaStore';

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('ios');
});

afterEach(() => setPlatform(originalOS));

it('returns direct native paths without asking the desktop media bridge', async () => {
  const { result } = await renderHook(() => useResolvedMediaUri('file:///media/cover.png'));

  await waitFor(() => expect(result.current).toBe('file:///media/cover.png'));

  expect(resolveBlobUri).not.toHaveBeenCalled();
});

it('resolves stable desktop paths into browser blob URIs on web', async () => {
  setPlatform('web');
  (resolveBlobUri as jest.Mock).mockResolvedValue('blob:cover');
  const { result } = await renderHook(() => useResolvedMediaUri('desktop-media:media/cover.png'));

  await waitFor(() => expect(result.current).toBe('blob:cover'));

  expect(resolveBlobUri).toHaveBeenCalledWith('desktop-media:media/cover.png');
});

it('leaves a missing or unreadable media path unresolved', async () => {
  setPlatform('web');
  (resolveBlobUri as jest.Mock).mockRejectedValueOnce(new Error('not found'));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const failed = await renderHook(() => useResolvedMediaUri('desktop-media:media/missing.png'));

  await waitFor(() => expect(failed.result.current).toBeNull());
  expect(resolveBlobUri).toHaveBeenCalled();

  const empty = await renderHook(() => useResolvedMediaUri(null));
  expect(empty.result.current).toBeNull();
});
