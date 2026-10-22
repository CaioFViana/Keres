import type { GalleryOwnerEntity } from '@keres/shared';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { GallerySelect } from '@/src/db/schema';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import { importPickedMediaAssets } from '@/src/services/media/galleryMediaImport';
import { createGalleryLink } from '@/src/services/media/galleryLink';
import { mediaFileService } from '@/src/services/media/MediaFileService';
import { createGalleryRelationService } from '@/src/services/storymanagement/relations/GalleryRelationService';
import { createGalleryService } from '@/src/services/storymanagement/media-music/GalleryService';
import { useStoryStore } from '@/src/state/story/storyStore';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';

const NO_MEDIA: GallerySelect[] = [];
const GALLERY_EVENTS = ['gallery_changed', 'gallery_relation_changed'] as const;

/**
 * The media linked to an entity (a character, location, note, scene, item or World Piece), with the means
 * of adding a new one and unlinking an existing one.
 *
 * The same shape as `useEntityRelations` (tags/notes): the hook owns the fetch, the
 * event subscriptions and the mutations, and the detail screen only consumes the result.
 */
export function useEntityGalleryMedia(ownerId: string | undefined, ownerType: GalleryOwnerEntity) {
  const drizzleDb = useDrizzle();
  const navigation = useNavigation();
  const { selectedStory } = useStoryStore();
  const { userId } = useUserSettingsStore();
  const storyId = selectedStory?.id;

  const services = useMemo(() => {
    if (!drizzleDb) {
      return null;
    }
    return {
      gallery: createGalleryService(drizzleDb),
      relation: createGalleryRelationService(drizzleDb),
    };
  }, [drizzleDb]);

  const [importing, setImporting] = useState(false);

  const load = useMemo(
    () =>
      services && storyId && ownerId
        ? () => services.gallery.getGalleriesForOwner(storyId, ownerId, ownerType)
        : null,
    [services, storyId, ownerId, ownerType],
  );
  const {
    data: media,
    loading,
    reload: refresh,
  } = useLoadedResource({
    load,
    initial: NO_MEDIA,
    events: GALLERY_EVENTS,
    storyId,
    label: `gallery media for ${ownerType} ${ownerId}`,
  });

  const linkImported = useCallback(
    async (galleryIds: string[]) => {
      if (!services || !storyId || !userId || !ownerId) return;
      for (const galleryId of galleryIds) {
        await services.relation.linkGalleryToOwner(userId, storyId, galleryId, {
          ownerId,
          ownerType,
        });
      }
    },
    [ownerId, ownerType, services, storyId, userId],
  );

  const importFromPicker = useCallback(
    async (picker: () => Promise<Awaited<ReturnType<typeof mediaFileService.pick>>>) => {
      if (!services || !storyId || !userId || !ownerId) return null;
      // The picker covers the app with a native activity: an open drawer would be revealed
      // mid-transition on return, so it is put away on both sides of the flow. A no-op when
      // already closed.
      navigation.dispatch(DrawerActions.closeDrawer());
      try {
        const assets = await picker();
        if (!assets) return null;
        setImporting(true);
        try {
          const summary = await importPickedMediaAssets(services.gallery, storyId, userId, assets);
          await linkImported(summary.galleryIds);
          await refresh();
          return summary;
        } finally {
          setImporting(false);
        }
      } finally {
        navigation.dispatch(DrawerActions.closeDrawer());
      }
    },
    [linkImported, navigation, ownerId, refresh, services, storyId, userId],
  );

  const addPlayableMedia = useCallback(
    () => importFromPicker(() => mediaFileService.pick()),
    [importFromPicker],
  );
  const addDocuments = useCallback(
    () => importFromPicker(() => mediaFileService.pickDocuments()),
    [importFromPicker],
  );
  const addLink = useCallback(
    async (url: string, title: string | null) => {
      if (!services || !storyId || !userId || !ownerId) return null;
      setImporting(true);
      try {
        const result = await createGalleryLink(services.gallery, storyId, userId, url, title);
        if (!result) return null;
        await linkImported([result.gallery.id]);
        await refresh();
        return {
          added: result.duplicate ? 0 : 1,
          duplicates: result.duplicate ? 1 : 0,
          rejected: 0,
          galleryIds: [result.gallery.id],
        };
      } finally {
        setImporting(false);
      }
    },
    [linkImported, ownerId, refresh, services, storyId, userId],
  );

  const getUnlinkedMedia = useCallback(async () => {
    if (!services || !storyId || !ownerId) return [];
    const linkedIds = new Set(media.map((item) => item.id));
    const allMedia = await services.gallery.getGalleriesByStoryId(storyId);
    return allMedia.filter((item) => !linkedIds.has(item.id));
  }, [media, ownerId, services, storyId]);

  /** Links existing gallery entries only; their files and metadata are left untouched. */
  const linkExistingMedia = useCallback(
    async (galleryIds: string[]) => {
      if (!services || !storyId || !userId || !ownerId) return 0;
      const linkedIds = new Set(media.map((item) => item.id));
      const uniqueIds = [...new Set(galleryIds)].filter((galleryId) => !linkedIds.has(galleryId));
      for (const galleryId of uniqueIds) {
        await services.relation.linkGalleryToOwner(userId, storyId, galleryId, {
          ownerId,
          ownerType,
        });
      }
      await refresh();
      return uniqueIds.length;
    },
    [media, ownerId, ownerType, refresh, services, storyId, userId],
  );

  /** It removes only the link with this entity; the medium carries on existing in the gallery. */
  const removeMedia = useCallback(
    async (galleryId: string) => {
      if (!services || !storyId || !userId || !ownerId) {
        return;
      }
      await services.relation.unlinkGalleryFromOwner(userId, storyId, galleryId, {
        ownerId,
        ownerType,
      });
      await refresh();
    },
    [refresh, services, storyId, userId, ownerId, ownerType],
  );

  return {
    media,
    loading,
    importing,
    storyId,
    addPlayableMedia,
    addDocuments,
    addLink,
    getUnlinkedMedia,
    linkExistingMedia,
    removeMedia,
    refresh,
  };
}
