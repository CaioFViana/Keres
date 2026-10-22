import type { StorySchemaEntityType } from '@keres/shared';
import { useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import type { EntityOption } from '@/src/services/entity-solvers/entityOptions';
import { loadEntityOptions } from '@/src/services/entity-solvers/entityOptions';
import { useLoadedResource } from './useLoadedResource';

const NO_OPTIONS: EntityOption[] = [];

/** Options for a picker whose target type is fixed by a Story Schema field. */
export function useEntityPickerOptions(
  storyId: string | undefined | null,
  entityType: StorySchemaEntityType | null | undefined,
) {
  const db = useDrizzle();
  const load = useMemo(
    () => (storyId && entityType ? () => loadEntityOptions(db, storyId, entityType) : null),
    [db, storyId, entityType],
  );
  const {
    data: options,
    loading,
    reload,
  } = useLoadedResource({
    load,
    initial: NO_OPTIONS,
    label: `${entityType ?? 'entity'} picker options`,
  });

  return { options, loading, reload };
}
