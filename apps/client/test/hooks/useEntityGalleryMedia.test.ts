/** @jest-environment node */
jest.mock('../../src/db', () => ({ useDrizzle: jest.fn() }));
jest.mock('../../src/state/storyStore', () => ({ useStoryStore: jest.fn() }));
jest.mock('../../src/state/userSettingsStore', () => ({ useUserSettingsStore: jest.fn() }));
jest.mock('../../src/services/storymanagement/GalleryService', () => ({
  createGalleryService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/GalleryRelationService', () => ({
  createGalleryRelationService: jest.fn(),
}));
jest.mock('../../src/services/galleryMediaImport', () => ({ importPickedMediaAssets: jest.fn() }));
jest.mock('../../src/services/MediaFileService', () => ({ mediaFileService: { pick: jest.fn() } }));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import { useEntityGalleryMedia } from '../../src/hooks/useEntityGalleryMedia';
import { importPickedMediaAssets } from '../../src/services/galleryMediaImport';
import { mediaFileService } from '../../src/services/MediaFileService';
import { createGalleryRelationService } from '../../src/services/storymanagement/GalleryRelationService';
import { createGalleryService } from '../../src/services/storymanagement/GalleryService';
import { useStoryStore } from '../../src/state/storyStore';
import { useUserSettingsStore } from '../../src/state/userSettingsStore';

const gallery = { getGalleriesForOwner: jest.fn() };
const relation = { linkGalleryToOwner: jest.fn(), unlinkGalleryFromOwner: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (useDrizzle as jest.Mock).mockReturnValue({});
  (useStoryStore as unknown as jest.Mock).mockReturnValue({ selectedStory: { id: 'story' } });
  (useUserSettingsStore as unknown as jest.Mock).mockReturnValue({ userId: 'user' });
  (createGalleryService as jest.Mock).mockReturnValue(gallery);
  (createGalleryRelationService as jest.Mock).mockReturnValue(relation);
  gallery.getGalleriesForOwner.mockResolvedValue([{ id: 'media-1' }]);
});

it('loads an owner media list and unlinks only the selected media', async () => {
  const { result } = await renderHook(() => useEntityGalleryMedia('character', 'Character'));
  await waitFor(() => expect(result.current.media).toEqual([{ id: 'media-1' }]));

  await act(async () => result.current.removeMedia('media-1'));
  expect(relation.unlinkGalleryFromOwner).toHaveBeenCalledWith('user', 'story', 'media-1', {
    ownerId: 'character',
    ownerType: 'Character',
  });
  expect(result.current.media).toEqual([]);
});

it('imports selected assets, links every resulting gallery, and refreshes', async () => {
  (mediaFileService.pick as jest.Mock).mockResolvedValue([{ name: 'map.png' }]);
  (importPickedMediaAssets as jest.Mock).mockResolvedValue({ galleryIds: ['new-1', 'new-2'] });
  const { result } = await renderHook(() => useEntityGalleryMedia('character', 'Character'));
  await waitFor(() => expect(result.current.loading).toBe(false));

  await act(async () => result.current.addMedia());
  expect(relation.linkGalleryToOwner).toHaveBeenCalledTimes(2);
  expect(relation.linkGalleryToOwner).toHaveBeenCalledWith('user', 'story', 'new-1', {
    ownerId: 'character',
    ownerType: 'Character',
  });
  expect(gallery.getGalleriesForOwner).toHaveBeenCalledTimes(2);
});
