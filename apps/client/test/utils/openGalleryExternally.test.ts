/**
 * @jest-environment node
 */
jest.mock('react-native', () => ({
  Linking: { openURL: jest.fn() },
}));
jest.mock('../../src/services/webMediaStore', () => ({
  DESKTOP_MEDIA_URI_PREFIX: 'desktop-media:',
  openInOs: jest.fn(),
  resolveBlobUri: jest.fn(),
}));

import { Linking } from 'react-native';
import { openInOs, resolveBlobUri } from '../../src/services/webMediaStore';
import { openGalleryExternally } from '../../src/utils/openGalleryExternally';

const openURL = Linking.openURL as jest.Mock;
const openInOsMock = openInOs as jest.Mock;
const resolveBlobUriMock = resolveBlobUri as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  openURL.mockResolvedValue(undefined);
  openInOsMock.mockResolvedValue(false);
});

it('opens a link in the system browser and never treats it as a local file', async () => {
  await expect(
    openGalleryExternally({
      mediaType: 'link',
      sourceUrl: 'https://notes.example/lore',
      localPath: 'file://should-not-use',
    } as never),
  ).resolves.toBe(true);
  expect(openURL).toHaveBeenCalledWith('https://notes.example/lore');
});

it('hands a native document to the OS instead of previewing it', async () => {
  await expect(
    openGalleryExternally({ mediaType: 'document', localPath: 'file://notes.pdf' } as never),
  ).resolves.toBe(true);
  expect(openURL).toHaveBeenCalledWith('file://notes.pdf');
});

it('asks Electron to open a desktop-stored document with the OS', async () => {
  openInOsMock.mockResolvedValue(true);
  await expect(
    openGalleryExternally({
      mediaType: 'document',
      localPath: 'desktop-media:media/story/hash.pdf',
    } as never),
  ).resolves.toBe(true);
  expect(openInOsMock).toHaveBeenCalledWith('media/story/hash.pdf');
  expect(openURL).not.toHaveBeenCalled();
});

it('opens a hosted-browser document in a new tab when there is no OS path', async () => {
  const windowOpen = jest.fn();
  (globalThis as unknown as { window: { open: typeof windowOpen } }).window = { open: windowOpen };
  resolveBlobUriMock.mockResolvedValue('blob:notes');

  await expect(
    openGalleryExternally({
      mediaType: 'document',
      localPath: 'desktop-media:media/story/hash.pdf',
    } as never),
  ).resolves.toBe(true);
  expect(windowOpen).toHaveBeenCalledWith('blob:notes', '_blank', 'noopener,noreferrer');
  delete (globalThis as unknown as { window?: unknown }).window;
});

it('leaves image/video/audio alone so the in-app player remains their path', async () => {
  await expect(
    openGalleryExternally({ mediaType: 'image', localPath: 'file://map.png' } as never),
  ).resolves.toBe(false);
  expect(openURL).not.toHaveBeenCalled();
});
