import type { GalleryOwnerEntity } from '@keres/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '../db';
import type { GallerySelect } from '../db/schema';
import { importPickedMediaAssets } from '../services/galleryMediaImport';
import { createGalleryLink } from '../services/galleryLink';
import { mediaFileService } from '../services/MediaFileService';
import { createGalleryRelationService } from '../services/storymanagement/GalleryRelationService';
import { createGalleryService } from '../services/storymanagement/GalleryService';
import { useStoryStore } from '../state/storyStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { entityEventEmitter } from '../utils/EventEmitter';

/**
 * The media linked to an entity (a character, location, note, scene or item), with the means
 * of adding a new one and unlinking an existing one.
 *
 * The same shape as `useEntityRelations` (tags/notes): the hook owns the fetch, the
 * event subscriptions and the mutations, and the detail screen only consumes the result.
 */
export function useEntityGalleryMedia(ownerId: string | undefined, ownerType: GalleryOwnerEntity) {
  const drizzleDb = useDrizzle();
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

  const [media, setMedia] = useState<GallerySelect[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const refresh = useCallback(async () => {
    if (!services || !storyId || !ownerId) {
      setMedia([]);
      return;
    }
    setLoading(true);
    try {
      setMedia(await services.gallery.getGalleriesForOwner(storyId, ownerId, ownerType));
    } catch (err) {
      console.error(`Failed to fetch gallery media for ${ownerType} ${ownerId}:`, err);
    } finally {
      setLoading(false);
    }
  }, [services, storyId, ownerId, ownerType]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) {
        refresh();
      }
    };
    entityEventEmitter.on('gallery_changed', handleChange);
    entityEventEmitter.on('gallery_relation_changed', handleChange);
    return () => {
      entityEventEmitter.off('gallery_changed', handleChange);
      entityEventEmitter.off('gallery_relation_changed', handleChange);
    };
  }, [storyId, refresh]);

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
    },
    [linkImported, ownerId, refresh, services, storyId, userId],
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
      setMedia((prev) => prev.filter((item) => item.id !== galleryId));
    },
    [services, storyId, userId, ownerId, ownerType],
  );

  return {
    media,
    loading,
    importing,
    storyId,
    addPlayableMedia,
    addDocuments,
    addLink,
    removeMedia,
    refresh,
  };
}
