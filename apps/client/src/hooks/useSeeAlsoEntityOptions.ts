import { Ionicons } from '@expo/vector-icons';
import { SEE_ALSO_ENTITY_TYPES, SeeAlsoEntityType } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GroupedMultiSelectGroup } from '@/src/components/common/inputs/GroupedMultiSelectPill/GroupedMultiSelectPill';
import { useDrizzle } from '../db';
import * as schema from '../db/schema';
import { SeeAlsoEntityRef } from '../services/storymanagement/SeeAlsoRelationService';
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
 * Candidatos ao picker de "Veja também": todas as entidades dos 8 tipos suportados na
 * história, exceto a própria entidade atual (uma entidade não pode se auto-referenciar).
 * Mesma estrutura de `useGalleryOwnerOptions`, generalizada para os 8 tipos.
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
      const [characters, locations, chapters, scenes, items, itemJourneys, worldRules, choices] =
        await Promise.all([
          db
            .select({ id: schema.characters.id, name: schema.characters.name })
            .from(schema.characters)
            .where(
              and(eq(schema.characters.storyId, storyId), eq(schema.characters.isDeleted, false)),
            ),
          db
            .select({ id: schema.locations.id, name: schema.locations.name })
            .from(schema.locations)
            .where(
              and(eq(schema.locations.storyId, storyId), eq(schema.locations.isDeleted, false)),
            ),
          db
            .select({ id: schema.chapters.id, name: schema.chapters.name })
            .from(schema.chapters)
            .where(and(eq(schema.chapters.storyId, storyId), eq(schema.chapters.isDeleted, false))),
          db
            .select({ id: schema.scenes.id, name: schema.scenes.name })
            .from(schema.scenes)
            .where(and(eq(schema.scenes.storyId, storyId), eq(schema.scenes.isDeleted, false))),
          db
            .select({ id: schema.items.id, name: schema.items.name })
            .from(schema.items)
            .where(and(eq(schema.items.storyId, storyId), eq(schema.items.isDeleted, false))),
          // ItemJourney não tem "name" próprio - newState é o campo mais próximo de um título.
          db
            .select({ id: schema.itemJourneys.id, name: schema.itemJourneys.newState })
            .from(schema.itemJourneys)
            .where(
              and(
                eq(schema.itemJourneys.storyId, storyId),
                eq(schema.itemJourneys.isDeleted, false),
              ),
            ),
          db
            .select({ id: schema.worldRules.id, name: schema.worldRules.title })
            .from(schema.worldRules)
            .where(
              and(eq(schema.worldRules.storyId, storyId), eq(schema.worldRules.isDeleted, false)),
            ),
          db
            .select({ id: schema.choices.id, name: schema.choices.text })
            .from(schema.choices)
            .where(and(eq(schema.choices.storyId, storyId), eq(schema.choices.isDeleted, false))),
        ]);

      const byType: Record<SeeAlsoEntityType, { id: string; name: string | null }[]> = {
        Character: characters,
        Location: locations,
        Chapter: chapters,
        Scene: scenes,
        Item: items,
        ItemJourney: itemJourneys,
        WorldRule: worldRules,
        Choice: choices,
      };

      const collected: SeeAlsoEntityOption[] = [];
      for (const entityType of SEE_ALSO_ENTITY_TYPES) {
        for (const row of byType[entityType]) {
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

  const groupedOptions: GroupedMultiSelectGroup[] = useMemo(() => {
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
