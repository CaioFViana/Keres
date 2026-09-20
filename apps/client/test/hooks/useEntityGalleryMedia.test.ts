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
jest.mock('../../src/services/galleryLink', () => ({ createGalleryLink: jest.fn() }));
jest.mock('../../src/services/MediaFileService', () => ({
  mediaFileService: { pick: jest.fn(), pickDocuments: jest.fn() },
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
  DrawerActions: { closeDrawer: () => ({ type: 'CLOSE_DRAWER' }) },
}));

const mockDispatch = jest.fn();

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import { useEntityGalleryMedia } from '../../src/hooks/useEntityGalleryMedia';
import { createGalleryLink } from '../../src/services/galleryLink';
import { importPickedMediaAssets } from '../../src/services/galleryMediaImport';
import { mediaFileService } from '../../src/services/MediaFileService';
import { createGalleryRelationService } from '../../src/services/storymanagement/GalleryRelationService';
import { createGalleryService } from '../../src/services/storymanagement/GalleryService';
import { useStoryStore } from '../../src/state/storyStore';
import { useUserSettingsStore } from '../../src/state/userSettingsStore';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const gallery = { getGalleriesForOwner: jest.fn(), getGalleriesByStoryId: jest.fn() };
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

  await act(async () => result.current.addPlayableMedia());
  // The drawer is put away before the picker covers the app and once it returns, so the
  // native activity transition can never reveal (or strand) an open menu.
  expect(mockDispatch).toHaveBeenCalledTimes(2);
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'CLOSE_DRAWER' });
  expect(relation.linkGalleryToOwner).toHaveBeenCalledTimes(2);
  expect(relation.linkGalleryToOwner).toHaveBeenCalledWith('user', 'story', 'new-1', {
    ownerId: 'character',
    ownerType: 'Character',
  });
  expect(gallery.getGalleriesForOwner).toHaveBeenCalledTimes(2);
});

it('imports documents through the document picker', async () => {
  (mediaFileService.pickDocuments as jest.Mock).mockResolvedValue([{ name: 'notes.pdf' }]);
  (importPickedMediaAssets as jest.Mock).mockResolvedValue({ galleryIds: ['doc-1'] });
  const { result } = await renderHook(() => useEntityGalleryMedia('character', 'Character'));
  await waitFor(() => expect(result.current.loading).toBe(false));

  await act(async () => result.current.addDocuments());
  expect(mediaFileService.pickDocuments).toHaveBeenCalled();
  expect(relation.linkGalleryToOwner).toHaveBeenCalledWith('user', 'story', 'doc-1', {
    ownerId: 'character',
    ownerType: 'Character',
  });
});

it('creates a link and attaches it to the owner', async () => {
  (createGalleryLink as jest.Mock).mockResolvedValue({
    gallery: { id: 'link-1' },
    duplicate: false,
  });
  const { result } = await renderHook(() => useEntityGalleryMedia('character', 'Character'));
  await waitFor(() => expect(result.current.loading).toBe(false));

  await act(async () => result.current.addLink('https://notes.example/lore', 'Lore'));
  expect(createGalleryLink).toHaveBeenCalledWith(
    gallery,
    'story',
    'user',
    'https://notes.example/lore',
    'Lore',
  );
  expect(relation.linkGalleryToOwner).toHaveBeenCalledWith('user', 'story', 'link-1', {
    ownerId: 'character',
    ownerType: 'Character',
  });
});

it('clears media without a target and logs refresh failures', async () => {
  (useDrizzle as jest.Mock).mockReturnValue(null);
  const nodb = await renderHook(() => useEntityGalleryMedia('character', 'Character'));
  await waitFor(() => expect(nodb.result.current.media).toEqual([]));
  (useDrizzle as jest.Mock).mockReturnValue({});

  const noowner = await renderHook(() => useEntityGalleryMedia(undefined, 'Character'));
  expect(noowner.result.current.media).toEqual([]);

  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  gallery.getGalleriesForOwner.mockRejectedValueOnce(new Error('offline'));
  const failing = await renderHook(() => useEntityGalleryMedia('character', 'Character'));
  await waitFor(() => expect(console.error).toHaveBeenCalled());
  expect(failing.result.current.loading).toBe(false);
});

it('refreshes only for gallery events on the active story', async () => {
  const { result } = await renderHook(() => useEntityGalleryMedia('character', 'Character'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  const calls = gallery.getGalleriesForOwner.mock.calls.length;

  await act(async () => entityEventEmitter.emit('gallery_changed', 'other-story'));
  expect(gallery.getGalleriesForOwner).toHaveBeenCalledTimes(calls);

  await act(async () => entityEventEmitter.emit('gallery_relation_changed', 'story'));
  await waitFor(() =>
    expect(gallery.getGalleriesForOwner.mock.calls.length).toBeGreaterThan(calls),
  );
});

it('links existing media once and lists the entries still unlinked', async () => {
  gallery.getGalleriesByStoryId.mockResolvedValue([
    { id: 'media-1' },
    { id: 'media-2' },
    { id: 'media-3' },
  ]);
  const { result } = await renderHook(() => useEntityGalleryMedia('character', 'Character'));
  await waitFor(() => expect(result.current.media).toEqual([{ id: 'media-1' }]));

  await act(async () => {
    const unlinked = await result.current.getUnlinkedMedia();
    expect(unlinked).toEqual([{ id: 'media-2' }, { id: 'media-3' }]);
  });

  let linked = 0;
  await act(async () => {
    linked = await result.current.linkExistingMedia(['media-2', 'media-2', 'media-1']);
  });
  expect(linked).toBe(1);
  expect(relation.linkGalleryToOwner).toHaveBeenCalledTimes(1);
  expect(relation.linkGalleryToOwner).toHaveBeenCalledWith('user', 'story', 'media-2', {
    ownerId: 'character',
    ownerType: 'Character',
  });

  const noowner = await renderHook(() => useEntityGalleryMedia(undefined, 'Character'));
  await act(async () => {
    expect(await noowner.result.current.getUnlinkedMedia()).toEqual([]);
    expect(await noowner.result.current.linkExistingMedia(['media-2'])).toBe(0);
    await noowner.result.current.removeMedia('media-1');
  });
  expect(relation.linkGalleryToOwner).toHaveBeenCalledTimes(1);
  expect(relation.unlinkGalleryFromOwner).not.toHaveBeenCalled();
});

it('does nothing without a local user and tolerates cancelled picks and links', async () => {
  (useUserSettingsStore as unknown as jest.Mock).mockReturnValue({ userId: null });
  const view = await renderHook(() => useEntityGalleryMedia('character', 'Character'));
  await waitFor(() => expect(view.result.current.media).toEqual([{ id: 'media-1' }]));

  await act(async () => {
    expect(await view.result.current.addPlayableMedia()).toBeNull();
    expect(await view.result.current.addLink('https://notes.example/lore', null)).toBeNull();
    expect(await view.result.current.linkExistingMedia(['media-2'])).toBe(0);
    await view.result.current.removeMedia('media-1');
  });
  expect(relation.linkGalleryToOwner).not.toHaveBeenCalled();
  expect(relation.unlinkGalleryFromOwner).not.toHaveBeenCalled();

  (useUserSettingsStore as unknown as jest.Mock).mockReturnValue({ userId: 'user' });
  await act(async () => view.rerender({}));
  (mediaFileService.pick as jest.Mock).mockResolvedValue(null);
  await act(async () => {
    expect(await view.result.current.addPlayableMedia()).toBeNull();
  });
  expect(mediaFileService.pick).toHaveBeenCalled();
  (createGalleryLink as jest.Mock).mockResolvedValue(null);
  await act(async () => {
    expect(await view.result.current.addLink('https://notes.example/lore', null)).toBeNull();
  });
  expect(createGalleryLink).toHaveBeenCalled();
});

it('counts duplicate links without adding them again', async () => {
  (createGalleryLink as jest.Mock).mockResolvedValue({
    gallery: { id: 'link-1' },
    duplicate: true,
  });
  const { result } = await renderHook(() => useEntityGalleryMedia('character', 'Character'));
  await waitFor(() => expect(result.current.loading).toBe(false));

  await act(async () => {
    const summary = await result.current.addLink('https://notes.example/lore', null);
    expect(summary).toEqual(
      expect.objectContaining({ added: 0, duplicates: 1, galleryIds: ['link-1'] }),
    );
  });
});
