import type { GalleryOwnerEntity } from '@keres/shared';
import {
  GALLERY_OWNER_ENTITIES,
  getWorldPieceSectionAppearance,
  WORLD_PIECE_SECTIONS,
} from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MultiSelectGroup } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { useDrizzle } from '../db';
import { useStoryVocabulary } from '../vocabulary/useStoryVocabulary';
import * as schema from '../db/schema';
import type { WorldPieceSection } from '@keres/shared/entities/WorldRule';

/**
 * The story's entities a media file can be linked to, ready for a picker.
 *
 * Each option's value is `Type:id` in a single field because the multi-picker works with a flat list of
 * strings; splitting it into one picker per type would fill the screen with no gain at all,
 * since the person thinks "link it to Ana", not "link it to a Character, and the character is Ana".
 */

export interface GalleryOwnerOption {
  /** Com o tipo prefixado (`"Personagem: Ana"`) - para a lista achatada, que mistura tipos. */
  label: string;
  /** Without the type prefix - for the grouped picker, where the type is already in the group's header. */
  name: string;
  value: string;
  ownerId: string;
  ownerType: GalleryOwnerEntity;
  worldPieceSection?: WorldPieceSection;
}

export function encodeOwnerValue(ownerType: GalleryOwnerEntity, ownerId: string): string {
  return `${ownerType}:${ownerId}`;
}

export function decodeOwnerValue(
  value: string,
): { ownerType: GalleryOwnerEntity; ownerId: string } | null {
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
  const { label } = useStoryVocabulary();
  const [options, setOptions] = useState<GalleryOwnerOption[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!storyId) {
      setOptions([]);
      return;
    }

    setLoading(true);
    try {
      const [characters, locations, notes, scenes, items, worldRules] = await Promise.all([
        db
          .select({ id: schema.characters.id, name: schema.characters.name })
          .from(schema.characters)
          .where(
            and(eq(schema.characters.storyId, storyId), eq(schema.characters.isDeleted, false)),
          ),
        db
          .select({ id: schema.locations.id, name: schema.locations.name })
          .from(schema.locations)
          .where(and(eq(schema.locations.storyId, storyId), eq(schema.locations.isDeleted, false))),
        // Notas usam `title` onde as outras usam `name`.
        db
          .select({ id: schema.notes.id, name: schema.notes.title })
          .from(schema.notes)
          .where(and(eq(schema.notes.storyId, storyId), eq(schema.notes.isDeleted, false))),
        db
          .select({ id: schema.scenes.id, name: schema.scenes.name })
          .from(schema.scenes)
          .where(and(eq(schema.scenes.storyId, storyId), eq(schema.scenes.isDeleted, false))),
        db
          .select({ id: schema.items.id, name: schema.items.name })
          .from(schema.items)
          .where(and(eq(schema.items.storyId, storyId), eq(schema.items.isDeleted, false))),
        db
          .select({
            id: schema.worldRules.id,
            name: schema.worldRules.title,
            section: schema.worldRules.section,
          })
          .from(schema.worldRules)
          .where(
            and(eq(schema.worldRules.storyId, storyId), eq(schema.worldRules.isDeleted, false)),
          ),
      ]);

      const byType: Record<
        GalleryOwnerEntity,
        { id: string; name: string | null; section?: WorldPieceSection }[]
      > = {
        Character: characters,
        Location: locations,
        Note: notes,
        Scene: scenes,
        Item: items,
        WorldRule: worldRules,
      };

      const collected: GalleryOwnerOption[] = [];
      for (const ownerType of GALLERY_OWNER_ENTITIES) {
        for (const row of byType[ownerType]) {
          const name = row.name || t('unnamed');
          collected.push({
            // The type goes into the label because the flat list mixes entity types: without it, two identical names
            // on different entities would be indistinguishable.
            label: `${label(ownerType)}: ${name}`,
            name,
            value: encodeOwnerValue(ownerType, row.id),
            ownerId: row.id,
            ownerType,
            worldPieceSection: ownerType === 'WorldRule' ? row.section : undefined,
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
  }, [db, label, storyId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const optionsByValue = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  );

  /**
   * The same links grouped by type, for the two-step picker (`GroupedMultiSelectPill`): the entity type
   * first, only then the list - which otherwise grows along with the story and becomes one long scroll,
   * with no filter, mixing all entity types.
   */
  const groupedOptions: MultiSelectGroup[] = useMemo(() => {
    const standardGroups = GALLERY_OWNER_ENTITIES.filter(
      (ownerType) => ownerType !== 'WorldRule',
    ).map((ownerType) => ({
      key: ownerType,
      label: label(ownerType, true),
      entityType: ownerType,
      options: options
        .filter((option) => option.ownerType === ownerType)
        .map((option) => ({ label: option.name, value: option.value })),
    }));
    const worldPieceGroups = WORLD_PIECE_SECTIONS.map((section) => {
      const appearance = getWorldPieceSectionAppearance(section);
      return {
        key: `WorldRule:${section}`,
        label: t(`world_piece_section_${section}`),
        icon: appearance.icon as MultiSelectGroup['icon'],
        color: appearance.color,
        options: options
          .filter(
            (option) => option.ownerType === 'WorldRule' && option.worldPieceSection === section,
          )
          .map((option) => ({ label: option.name, value: option.value, color: appearance.color })),
      };
    });
    return [...standardGroups, ...worldPieceGroups].filter((group) => group.options.length > 0);
  }, [label, options, t]);

  return { options, optionsByValue, groupedOptions, loading, reload: load };
}
