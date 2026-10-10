import { useCallback, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { StoryArcSelect } from '@/src/db/schema';
import { useArcChangeReload } from '@/src/hooks/useArcChangeReload';
import { useEntityInitialLoad } from '@/src/hooks/useEntityRefreshLifecycle';
import { createStoryArcService } from '@/src/services/storymanagement/StoryArcService';

export type AppearsInArcKind = 'character' | 'location' | 'item';

/** Derived Arc membership from scene links; empty until the entity appears in a chaptered scene. */
export function useAppearsInArcs(storyId: string, kind: AppearsInArcKind, entityId: string) {
  const db = useDrizzle();
  const [arcs, setArcs] = useState<StoryArcSelect[]>([]);

  const reload = useCallback(async () => {
    if (!storyId || !entityId) {
      setArcs([]);
      return;
    }
    const service = createStoryArcService(db);
    const next =
      kind === 'character'
        ? await service.listArcsForCharacter(storyId, entityId)
        : kind === 'location'
          ? await service.listArcsForLocation(storyId, entityId)
          : await service.listArcsForItem(storyId, entityId);
    setArcs(next);
  }, [db, entityId, kind, storyId]);

  useEntityInitialLoad(reload);
  useArcChangeReload(storyId, kind, reload);

  return arcs;
}
