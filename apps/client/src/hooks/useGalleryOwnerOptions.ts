import { GALLERY_OWNER_ENTITIES, GalleryOwnerEntity } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import * as schema from '../db/schema';

/**
 * As entidades da história às quais uma mídia pode ser vinculada, prontas para um seletor.
 *
 * O valor de cada opção é `Tipo:id` num campo só porque o seletor múltiplo trabalha com
 * uma lista plana de strings; separar em cinco seletores (um por tipo) encheria a tela sem
 * ganho nenhum, já que a pessoa pensa em "vincular à Ana", não em "vincular a um
 * Personagem, e o personagem é a Ana".
 */

export interface GalleryOwnerOption {
  label: string;
  value: string;
  ownerId: string;
  ownerType: GalleryOwnerEntity;
}

export function encodeOwnerValue(ownerType: GalleryOwnerEntity, ownerId: string): string {
  return `${ownerType}:${ownerId}`;
}

export function decodeOwnerValue(value: string): { ownerType: GalleryOwnerEntity; ownerId: string } | null {
  const separator = value.indexOf(':');
  if (separator < 0) {
    return null;
  }
  const ownerType = value.slice(0, separator) as GalleryOwnerEntity;
  const ownerId = value.slice(separator + 1);

  if (!GALLERY_OWNER_ENTITIES.includes(ownerType) || !ownerId) {
    return null;
  }
  return { ownerType, ownerId };
}

export function useGalleryOwnerOptions(storyId: string | undefined) {
  const db = useDrizzle();
  const { t } = useTranslation();
  const [options, setOptions] = useState<GalleryOwnerOption[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!storyId) {
      setOptions([]);
      return;
    }

    setLoading(true);
    try {
      const [characters, locations, notes, scenes, items] = await Promise.all([
        db.select({ id: schema.characters.id, name: schema.characters.name })
          .from(schema.characters)
          .where(and(eq(schema.characters.storyId, storyId), eq(schema.characters.isDeleted, false))),
        db.select({ id: schema.locations.id, name: schema.locations.name })
          .from(schema.locations)
          .where(and(eq(schema.locations.storyId, storyId), eq(schema.locations.isDeleted, false))),
        // Notas usam `title` onde as outras usam `name`.
        db.select({ id: schema.notes.id, name: schema.notes.title })
          .from(schema.notes)
          .where(and(eq(schema.notes.storyId, storyId), eq(schema.notes.isDeleted, false))),
        db.select({ id: schema.scenes.id, name: schema.scenes.name })
          .from(schema.scenes)
          .where(and(eq(schema.scenes.storyId, storyId), eq(schema.scenes.isDeleted, false))),
        db.select({ id: schema.items.id, name: schema.items.name })
          .from(schema.items)
          .where(and(eq(schema.items.storyId, storyId), eq(schema.items.isDeleted, false))),
      ]);

      const byType: Record<GalleryOwnerEntity, { id: string; name: string | null }[]> = {
        Character: characters,
        Location: locations,
        Note: notes,
        Scene: scenes,
        Item: items,
      };

      const collected: GalleryOwnerOption[] = [];
      for (const ownerType of GALLERY_OWNER_ENTITIES) {
        for (const row of byType[ownerType]) {
          collected.push({
            // O tipo entra no rótulo porque a lista mistura os cinco: sem ele, dois nomes
            // iguais em entidades diferentes ficariam indistinguíveis.
            label: `${t(ownerType.toLowerCase())}: ${row.name || t('unnamed')}`,
            value: encodeOwnerValue(ownerType, row.id),
            ownerId: row.id,
            ownerType,
          });
        }
      }

      setOptions(collected);
    } catch (error) {
      console.error('Failed to load gallery owner options:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [db, storyId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const optionsByValue = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options]
  );

  return { options, optionsByValue, loading, reload: load };
}
