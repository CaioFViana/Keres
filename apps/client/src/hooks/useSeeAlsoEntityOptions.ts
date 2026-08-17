import { Ionicons } from '@expo/vector-icons';
import { SEE_ALSO_ENTITY_TYPES, SeeAlsoEntityType } from '@keres/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MultiSelectGroup } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { useDrizzle } from '../db';
import { SeeAlsoEntityRef } from '../services/storymanagement/SeeAlsoRelationService';
import { loadEntityOptions } from '../utils/entityOptions';
import { ENTITY_TYPE_ICONS } from '../utils/entityTypeIcons';

export interface SeeAlsoEntityOption {
  label: string;
  name: string;
  value: string;
  entityType: SeeAlsoEntityType;
  entityId: string;
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
  const [options, setOptions] = useState<SeeAlsoEntityOption[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!storyId) {
      setOptions([]);
      return;
    }

    setLoading(true);
    try {
      const optionsByType = await Promise.all(
        SEE_ALSO_ENTITY_TYPES.map(
          async (entityType) =>
            [entityType, await loadEntityOptions(db, storyId, entityType)] as const,
        ),
      );

      const collected: SeeAlsoEntityOption[] = [];
      for (const [entityType, rows] of optionsByType) {
        for (const row of rows) {
          if (entityType === excludeEntityType && row.id === excludeEntityId) continue;
          const name = row.name || t('unnamed');
          collected.push({
            label: `${t(entityType.toLowerCase())}: ${name}`,
            name,
            value: encodeSeeAlsoValue(entityType, row.id),
            entityType,
            entityId: row.id,
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
  }, [db, storyId, excludeEntityType, excludeEntityId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const optionsByValue = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  );

  const groupedOptions: MultiSelectGroup[] = useMemo(() => {
    return SEE_ALSO_ENTITY_TYPES.map((entityType) => ({
      key: entityType,
      label: t(`${entityType.toLowerCase()}s`),
      icon: ENTITY_TYPE_ICONS[entityType] as keyof typeof Ionicons.glyphMap,
      options: options
        .filter((option) => option.entityType === entityType)
        .map((option) => ({ label: option.name, value: option.value })),
    }));
  }, [options, t]);

  return { options, optionsByValue, groupedOptions, loading, reload: load };
}
