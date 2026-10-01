import { Image, Platform } from 'react-native';

jest.mock('../../src/services/webMediaStore', () => ({
  __esModule: true,
  DESKTOP_MEDIA_URI_PREFIX: 'desktop-media:',
  resolveBlobUri: jest.fn(),
}));

import { resolveBlobUri } from '../../src/services/webMediaStore';
import { imageSizeOf, resolveImagePath } from '../../src/utils/locationMapMedia';

const originalOS = Platform.OS;

function setOS(os: string) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  setOS('ios');
});

afterEach(() => setOS(originalOS));

describe('resolveImagePath', () => {
  it('returns the path untouched off web', async () => {
    await expect(resolveImagePath('desktop-media:cover.jpg')).resolves.toBe(
      'desktop-media:cover.jpg',
    );
    expect(resolveBlobUri).not.toHaveBeenCalled();
  });

  it('resolves desktop URIs to blob URIs on web', async () => {
    setOS('web');
    (resolveBlobUri as jest.Mock).mockResolvedValue('blob:cover');

    await expect(resolveImagePath('desktop-media:cover.jpg')).resolves.toBe('blob:cover');
    expect(resolveBlobUri).toHaveBeenCalledWith('desktop-media:cover.jpg');
  });

  it('leaves ordinary paths alone on web', async () => {
    setOS('web');

    await expect(resolveImagePath('file:///tmp/cover.jpg')).resolves.toBe('file:///tmp/cover.jpg');
    expect(resolveBlobUri).not.toHaveBeenCalled();
  });
});

describe('imageSizeOf', () => {
  it('reports the natural size through the resolved URI', async () => {
    const spy = jest.spyOn(Image, 'getSize').mockImplementation(((
      uri: string,
      success: (w: number, h: number) => void,
    ) => {
      expect(uri).toBe('file:///tmp/cover.jpg');
      success(320, 240);
    }) as any);

    try {
      await expect(imageSizeOf('file:///tmp/cover.jpg')).resolves.toEqual({
        width: 320,
        height: 240,
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects when the size lookup fails', async () => {
    const failure = new Error('no such image');
    const spy = jest.spyOn(Image, 'getSize').mockImplementation(((...args: any[]) => {
      args[2](failure);
    }) as any);

    try {
      await expect(imageSizeOf('file:///tmp/cover.jpg')).rejects.toBe(failure);
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects when the path cannot be resolved', async () => {
    setOS('web');
    const failure = new Error('store unavailable');
    (resolveBlobUri as jest.Mock).mockRejectedValue(failure);

    await expect(imageSizeOf('desktop-media:cover.jpg')).rejects.toBe(failure);
  });
});
