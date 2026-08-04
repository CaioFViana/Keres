import { StorySchemaEntityType } from '@keres/shared';
import { useCallback, useEffect, useState } from 'react';
import { useDrizzle } from '../db';
import { StorySchemaFieldSelect } from '../db/schema';
import { createStorySchemaFieldService } from '../services/storymanagement/StorySchemaFieldService';
import { entityEventEmitter } from '../utils/EventEmitter';

/**
 * Campos customizados de Story Schema para um `entityType` dentro de uma story, já ordenados
 * por `order` - usado tanto pelos Form/Detail screens (via `CustomAttributeFields`/
 * `CustomAttributeDetailFields`) quanto pela tela de gerenciamento de schemas.
 */
export function useStorySchemaFields(storyId: string | undefined | null, entityType: StorySchemaEntityType): StorySchemaFieldSelect[] {
  const drizzleDb = useDrizzle();
  const [fields, setFields] = useState<StorySchemaFieldSelect[]>([]);

  const fetchFields = useCallback(async () => {
    if (!storyId) {
      setFields([]);
      return;
    }
    try {
      const service = createStorySchemaFieldService(drizzleDb);
      const result = await service.getFieldsByStoryAndEntityType(storyId, entityType);
      setFields(result);
    } catch (error) {
      console.error(`Failed to load story schema fields for ${entityType}:`, error);
      setFields([]);
    }
  }, [drizzleDb, storyId, entityType]);

  useEffect(() => {
    fetchFields();
    entityEventEmitter.on('story_schema_field_changed', fetchFields);
    return () => {
      entityEventEmitter.off('story_schema_field_changed', fetchFields);
    };
  }, [fetchFields]);

  return fields;
}
