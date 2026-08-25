import type { StorySchemaEntityType } from '@keres/shared';
import { useCallback, useEffect, useState } from 'react';
import { useDrizzle } from '../db';
import type { EntityOption } from '../utils/entityOptions';
import { loadEntityOptions } from '../utils/entityOptions';

/** Options for a picker whose target type is fixed by a Story Schema field. */
export function useEntityPickerOptions(
  storyId: string | undefined | null,
  entityType: StorySchemaEntityType | null | undefined,
) {
  const db = useDrizzle();
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!storyId || !entityType) {
      setOptions([]);
      return;
    }

    setLoading(true);
    try {
      setOptions(await loadEntityOptions(db, storyId, entityType));
    } catch (error) {
      console.error(`Failed to load ${entityType} picker options:`, error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [db, storyId, entityType]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { options, loading, reload };
}
