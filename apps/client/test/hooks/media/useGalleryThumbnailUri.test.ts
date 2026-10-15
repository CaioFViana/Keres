/** @jest-environment node */
jest.mock('@/src/services/platform-web/webMediaStore', () => ({
  __esModule: true,
  DESKTOP_MEDIA_URI_PREFIX: 'desktop-media:',
  resolveBlobUri: jest.fn(async (path: string) => `blob:${path}`),
}));
jest.mock('@/src/services/media/MediaFileService', () => ({
  __esModule: true,
  mediaFileService: {
    thumbnailPathFor: jest.fn(
      (story: string, hash: string) => `desktop-media:media/${story}/${hash}_thumb.jpg`,
    ),
    exists: jest.fn(() => false),
    ensureImageThumbnail: jest.fn(),
  },
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import {
  type GalleryThumbnailSource,
  useGalleryThumbnailUri,
} from '@/src/hooks/media/useGalleryThumbnailUri';
import { mediaFileService } from '@/src/services/media/MediaFileService';

const service = mediaFileService as jest.Mocked<typeof mediaFileService>;

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
const originalOS = Platform.OS;

const BIG = 5 * 1024 * 1024;
const picture = (over: Partial<GalleryThumbnailSource> = {}): GalleryThumbnailSource => ({
  storyId: 'story',
  hash: 'abc',
  mediaType: 'image',
  mimeType: 'image/jpeg',
  sizeBytes: BIG,
  localPath: 'desktop-media:media/story/abc.jpg',
  thumbnailPath: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  service.exists.mockReturnValue(false);
  setPlatform('web');
});

afterEach(() => setPlatform(originalOS));

it('shows the thumbnail of a big picture once it exists, and never the picture itself', async () => {
  service.exists.mockReturnValue(true);

  const { result } = await renderHook(() => useGalleryThumbnailUri(picture()));

  await waitFor(() => expect(result.current).toBe('blob:desktop-media:media/story/abc_thumb.jpg'));
  expect(service.ensureImageThumbnail).not.toHaveBeenCalled();
});

it('shows nothing while the thumbnail is made, then the thumbnail', async () => {
  let finish: (uri: string) => void = () => undefined;
  service.ensureImageThumbnail.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );

  const { result } = await renderHook(() => useGalleryThumbnailUri(picture()));

  expect(result.current).toBeNull();
  expect(service.ensureImageThumbnail).toHaveBeenCalledWith(
    'story',
    'abc',
    'desktop-media:media/story/abc.jpg',
    'image/jpeg',
  );

  service.exists.mockReturnValue(true);
  finish('desktop-media:media/story/abc_thumb.jpg');
  await waitFor(() => expect(result.current).toBe('blob:desktop-media:media/story/abc_thumb.jpg'));
});

it('falls back to the picture itself when no thumbnail can be made', async () => {
  service.ensureImageThumbnail.mockResolvedValue(undefined);

  const { result } = await renderHook(() => useGalleryThumbnailUri(picture()));

  await waitFor(() => expect(result.current).toBe('blob:desktop-media:media/story/abc.jpg'));
});

it('shows a small picture as it is, without asking for a thumbnail', async () => {
  const { result } = await renderHook(() => useGalleryThumbnailUri(picture({ sizeBytes: 10_000 })));

  await waitFor(() => expect(result.current).toBe('blob:desktop-media:media/story/abc.jpg'));
  expect(service.ensureImageThumbnail).not.toHaveBeenCalled();
});

it('shows a video by its extracted frame', async () => {
  const { result } = await renderHook(() =>
    useGalleryThumbnailUri(
      picture({
        mediaType: 'video',
        mimeType: 'video/mp4',
        thumbnailPath: 'desktop-media:media/story/v_thumb.jpg',
      }),
    ),
  );

  await waitFor(() => expect(result.current).toBe('blob:desktop-media:media/story/v_thumb.jpg'));
  expect(service.ensureImageThumbnail).not.toHaveBeenCalled();
});

it('leaves native alone: the picture itself, decoded by the image component to the size it is shown at', async () => {
  setPlatform('android');

  const { result } = await renderHook(() =>
    useGalleryThumbnailUri(picture({ localPath: 'file:///media/story/abc.jpg' })),
  );

  expect(result.current).toBe('file:///media/story/abc.jpg');
  expect(service.ensureImageThumbnail).not.toHaveBeenCalled();
});

it('has nothing for a medium that is not there', async () => {
  const { result } = await renderHook(() => useGalleryThumbnailUri(null));

  expect(result.current).toBeNull();
});
