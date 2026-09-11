import { AttributeType } from '@keres/shared';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import type { StorySchemaFieldSelect } from '../db/schema';
import { EntityService } from '../services/EntityService';
import { createAttributeValueService } from '../services/storymanagement/AttributeValueService';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useEntityInitialLoad } from './useEntityRefreshLifecycle';

/** EAV values and resolved entity names for a detail screen's custom fields. */
export function useCustomAttributeValues(
  storyId: string,
  entityId: string,
  fields: StorySchemaFieldSelect[],
) {
  const { t } = useTranslation();
  const drizzleDb = useDrizzle();
  const [values, setValues] = useState<Record<string, string | null>>({});
  const [resolvedEntityNames, setResolvedEntityNames] = useState<Record<string, string>>({});

  const fetchValues = useCallback(async () => {
    try {
      const service = createAttributeValueService(drizzleDb);
      const rows = await service.getValuesForEntity(entityId);
      const loadedValues = Object.fromEntries(rows.map((row) => [row.fieldId, row.value]));
      setValues(loadedValues);

      const names = await Promise.all(
        fields
          .filter(
            (field) =>
              field.type === AttributeType.ENTITY &&
              field.targetEntityType &&
              loadedValues[field.id],
          )
          .map(async (field) => {
            const name = await EntityService.getEntityIdentifier(
              drizzleDb,
              field.targetEntityType!,
              loadedValues[field.id]!,
              storyId,
              t,
            );
            return [field.id, name] as const;
          }),
      );
      setResolvedEntityNames(
        Object.fromEntries(
          names.filter((entry): entry is readonly [string, string] => entry[1] !== undefined),
        ),
      );
    } catch (error) {
      console.error('Failed to load attribute values:', error);
      setValues({});
      setResolvedEntityNames({});
    }
  }, [drizzleDb, entityId, fields, storyId, t]);

  useEntityInitialLoad(fetchValues);

  useEffect(() => {
    entityEventEmitter.on('attribute_value_changed', fetchValues);
    return () => {
      entityEventEmitter.off('attribute_value_changed', fetchValues);
    };
  }, [fetchValues]);

  return { values, resolvedEntityNames };
}
