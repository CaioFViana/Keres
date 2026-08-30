/** @jest-environment node */
jest.mock('../../src/services/webMediaStore', () => ({
  __esModule: true,
  DESKTOP_MEDIA_URI_PREFIX: 'desktop-media:',
  resolveBlobUri: jest.fn(),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useResolvedMediaUris } from '../../src/hooks/useResolvedMediaUris';
import { resolveBlobUri } from '../../src/services/webMediaStore';

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('web');
});

afterEach(() => setPlatform(originalOS));

it('resolves each desktop path once, preserves direct paths and makes a failed item explicit', async () => {
  (resolveBlobUri as jest.Mock).mockImplementation((path: string) =>
    path.endsWith('missing') ? Promise.reject(new Error('missing')) : Promise.resolve(`blob:${path}`),
  );
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  const view = await renderHook(() =>
    useResolvedMediaUris([
      'desktop-media:cover',
      'file:///native.png',
      'desktop-media:cover',
      null,
      'desktop-media:missing',
    ]),
  );

  await waitFor(() =>
    expect(view.result.current).toEqual({
      'desktop-media:cover': 'blob:desktop-media:cover',
      'file:///native.png': 'file:///native.png',
      'desktop-media:missing': null,
    }),
  );
  expect(resolveBlobUri).toHaveBeenCalledTimes(2);
});

it('clears stale resolved values when there are no paths left', async () => {
  (resolveBlobUri as jest.Mock).mockResolvedValue('blob:cover');
  let paths: (string | null)[] = ['desktop-media:cover'];
  const view = await renderHook(() => useResolvedMediaUris(paths));
  await waitFor(() => expect(view.result.current['desktop-media:cover']).toBe('blob:cover'));

  paths = [];
  await view.rerender(undefined as never);
  await waitFor(() => expect(view.result.current).toEqual({}));
});
