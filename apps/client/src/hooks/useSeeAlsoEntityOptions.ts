import type { Ionicons } from '@expo/vector-icons';
import type { SeeAlsoEntityType } from '@keres/shared';
import {
  getEntityAppearance,
  SEE_ALSO_ENTITY_TYPES,
  WORLD_PIECE_SECTION_APPEARANCE,
} from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MultiSelectGroup } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { useDrizzle } from '../db';
import { worldRules } from '../db';
import type { SeeAlsoEntityRef } from '../services/storymanagement/SeeAlsoRelationService';
import { loadEntityOptions } from '../utils/entityOptions';
import { ENTITY_TYPE_ICONS } from '../utils/entityTypeIcons';
import { useStoryVocabulary } from '../vocabulary/useStoryVocabulary';
import type { WorldPieceSection } from '@keres/shared/entities/WorldRule';

export interface SeeAlsoEntityOption {
  label: string;
  name: string;
  value: string;
  entityType: SeeAlsoEntityType;
  entityId: string;
  worldPieceSection?: WorldPieceSection;
  color?: string;
}

export function encodeSeeAlsoValue(entityType: SeeAlsoEntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export function decodeSeeAlsoValue(value: string): SeeAlsoEntityRef | null {
  const separator = value.indexOf(':');
  if (separator < 0) return null;
  const entityType = value.slice(0, separator) as SeeAlsoEntityType;
  const entityId = value.slice(separator + 1);
  if (!(SEE_ALSO_ENTITY_TYPES as readonly string[]).includes(entityType) || !entityId) return null;
  return { entityType, entityId };
}

/**
 * Candidates for the "See also" picker, excluding the current entity. Entity
 * titles come from `loadEntityOptions`, the same registry used by references
 * and global search.
 */
export function useSeeAlsoEntityOptions(
  storyId: string | undefined,
  excludeEntityType: SeeAlsoEntityType,
  excludeEntityId: string | undefined,
) {
  const db = useDrizzle();
  const { t } = useTranslation();
  const { label } = useStoryVocabulary();
  const [options, setOptions] = useState<SeeAlsoEntityOption[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!storyId) {
      setOptions([]);
      return;
    }

    setLoading(true);
    try {
      const [optionsByType, worldPieceRows] = await Promise.all([
        Promise.all(
          SEE_ALSO_ENTITY_TYPES.map(
            async (entityType) =>
              [entityType, await loadEntityOptions(db, storyId, entityType)] as const,
          ),
        ),
        db
          .select({ id: worldRules.id, section: worldRules.section })
          .from(worldRules)
          .where(and(eq(worldRules.storyId, storyId), eq(worldRules.isDeleted, false)))
          .all(),
      ]);
      const sectionByWorldPieceId = new Map(
        worldPieceRows.map((piece) => [piece.id, piece.section]),
      );

      const collected: SeeAlsoEntityOption[] = [];
      for (const [entityType, rows] of optionsByType) {
        for (const row of rows) {
          if (entityType === excludeEntityType && row.id === excludeEntityId) continue;
          const name = row.name || t('unnamed');
          const worldPieceSection =
            entityType === 'WorldRule' ? sectionByWorldPieceId.get(row.id) : undefined;
          collected.push({
            label: `${label(entityType)}: ${name}`,
            name,
            value: encodeSeeAlsoValue(entityType, row.id),
            entityType,
            entityId: row.id,
            worldPieceSection,
            // A World Piece section is more specific than its underlying WorldRule entity.
            color: worldPieceSection
              ? WORLD_PIECE_SECTION_APPEARANCE[worldPieceSection].color
              : getEntityAppearance(entityType).color,
          });
        }
      }

      setOptions(collected);
    } catch (error) {
      console.error('Failed to load See Also entity options:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [db, storyId, excludeEntityType, excludeEntityId, t, label]);

  useEffect(() => {
    load();
  }, [load]);

  const optionsByValue = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  );

  const groupedOptions: MultiSelectGroup[] = useMemo(() => {
    const groups: MultiSelectGroup[] = [];
    SEE_ALSO_ENTITY_TYPES.forEach((entityType) => {
      if (entityType !== 'WorldRule') {
        groups.push({
          key: entityType,
          label: label(entityType, true),
          icon: ENTITY_TYPE_ICONS[entityType] as keyof typeof Ionicons.glyphMap,
          options: options
            .filter((option) => option.entityType === entityType)
            .map((option) => ({
              label: option.name,
              value: option.value,
              color: option.color,
            })),
        });
        return;
      }
      (Object.keys(WORLD_PIECE_SECTION_APPEARANCE) as WorldPieceSection[]).forEach((section) => {
        const appearance = WORLD_PIECE_SECTION_APPEARANCE[section];
        groups.push({
          key: `WorldRule:${section}`,
          label: t(`world_piece_section_${section}`),
          icon: appearance.icon as keyof typeof Ionicons.glyphMap,
          color: appearance.color,
          options: options
            .filter(
              (option) => option.entityType === 'WorldRule' && option.worldPieceSection === section,
            )
            .map((option) => ({ label: option.name, value: option.value, color: option.color })),
        });
      });
    });
    return groups;
  }, [label, options, t]);

  return { options, optionsByValue, groupedOptions, loading, reload: load };
}
