/**
 * @jest-environment node
 */
jest.mock('spark-md5', () => ({
  __esModule: true,
  default: { hash: (value: string) => `hash-${value}`.slice(0, 32).padEnd(32, '0') },
}));

import { createGalleryLink, hashGalleryLink } from '../../src/services/galleryLink';

const galleryService = {
  getByHash: jest.fn(),
  createGallery: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('rejects anything that is not an http(s) URL', async () => {
  await expect(
    createGalleryLink(galleryService as never, 'story', 'user', 'javascript:alert(1)'),
  ).resolves.toBeNull();
  expect(galleryService.createGallery).not.toHaveBeenCalled();
});

it('reuses an existing gallery row when the URL was already catalogued', async () => {
  galleryService.getByHash.mockResolvedValue({ id: 'existing' });
  await expect(
    createGalleryLink(galleryService as never, 'story', 'user', 'https://notes.example/lore'),
  ).resolves.toEqual({ gallery: { id: 'existing' }, duplicate: true });
  expect(galleryService.createGallery).not.toHaveBeenCalled();
});

it('stores the URL, hashes it, and never asks for a local file', async () => {
  galleryService.getByHash.mockResolvedValue(undefined);
  galleryService.createGallery.mockResolvedValue({ id: 'new-link' });

  await expect(
    createGalleryLink(
      galleryService as never,
      'story',
      'user',
      'https://notes.example/lore',
      'Lore',
    ),
  ).resolves.toEqual({ gallery: { id: 'new-link' }, duplicate: false });

  expect(galleryService.createGallery).toHaveBeenCalledWith(
    'user',
    expect.objectContaining({
      storyId: 'story',
      mediaType: 'link',
      mimeType: 'text/uri-list',
      fileName: 'notes.example',
      hash: hashGalleryLink('https://notes.example/lore'),
      sizeBytes: 0,
      sourceUrl: 'https://notes.example/lore',
      title: 'Lore',
      localPath: null,
    }),
  );
});
