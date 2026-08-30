import type { StorySchemaEntityType } from '@keres/shared';
import { useCallback, useEffect, useState } from 'react';
import { useDrizzle } from '../db';
import type { StorySchemaFieldSelect } from '../db/schema';
import { createStorySchemaFieldService } from '../services/storymanagement/StorySchemaFieldService';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useEntityInitialLoad } from './useEntityRefreshLifecycle';

/**
 * A Story Schema's custom fields for an `entityType` within a story, already sorted by `order` - used
 * both by the Form/Detail screens (through
 * `CustomAttributeFields`/`CustomAttributeDetailFields`) and by the schema management screen.
 */
export function useStorySchemaFields(
  storyId: string | undefined | null,
  entityType: StorySchemaEntityType,
): StorySchemaFieldSelect[] {
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

  useEntityInitialLoad(fetchFields);

  useEffect(() => {
    entityEventEmitter.on('story_schema_field_changed', fetchFields);
    return () => {
      entityEventEmitter.off('story_schema_field_changed', fetchFields);
    };
  }, [fetchFields]);

  return fields;
}
