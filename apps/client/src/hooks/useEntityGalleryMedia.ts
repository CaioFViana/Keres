import type { GalleryOwnerEntity } from '@keres/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '../db';
import type { GallerySelect } from '../db/schema';
import { importPickedMediaAssets } from '../services/galleryMediaImport';
import { mediaFileService } from '../services/MediaFileService';
import { createGalleryRelationService } from '../services/storymanagement/GalleryRelationService';
import { createGalleryService } from '../services/storymanagement/GalleryService';
import { useStoryStore } from '../state/storyStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { entityEventEmitter } from '../utils/EventEmitter';

/**
 * Mídias vinculadas a uma entidade (personagem, local, nota, cena ou item), com os meios
 * de adicionar uma nova e desvincular uma existente.
 *
 * Mesmo formato de `useEntityRelations` (tags/notas): o hook possui a busca, as
 * assinaturas de evento e as mutações, e a tela de detalhe só consome o resultado.
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

  /** Abre o seletor, importa o que foi escolhido e já vincula tudo a esta entidade. */
  const addMedia = useCallback(async () => {
    if (!services || !storyId || !userId || !ownerId) {
      return null;
    }

    const assets = await mediaFileService.pick();
    if (!assets) {
      return null;
    }

    setImporting(true);
    try {
      const summary = await importPickedMediaAssets(services.gallery, storyId, userId, assets);
      for (const galleryId of summary.galleryIds) {
        await services.relation.linkGalleryToOwner(userId, storyId, galleryId, {
          ownerId,
          ownerType,
        });
      }
      await refresh();
      return summary;
    } finally {
      setImporting(false);
    }
  }, [services, storyId, userId, ownerId, ownerType, refresh]);

  /** Remove só o vínculo com esta entidade; a mídia continua existindo na galeria. */
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

  return { media, loading, importing, storyId, addMedia, removeMedia, refresh };
}
