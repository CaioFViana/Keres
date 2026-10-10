import { useCallback, useState } from 'react';
import { useDrizzle } from '@/src/db';
import { useArcChangeReload } from '@/src/hooks/useArcChangeReload';
import { useEntityInitialLoad } from '@/src/hooks/useEntityRefreshLifecycle';
import {
  createStoryArcService,
  type ArcMembershipKind,
} from '@/src/services/storymanagement/StoryArcService';

/** Bulk arc membership for every linked entity of one kind; unlinked entities are absent. */
export function useEntityArcIds(storyId: string, kind: ArcMembershipKind) {
  const db = useDrizzle();
  const [arcIds, setArcIds] = useState<Map<string, string[]>>(new Map());

  const reload = useCallback(async () => {
    if (!storyId) {
      setArcIds(new Map());
      return;
    }
    setArcIds(await createStoryArcService(db).listEntityArcIds(storyId, kind));
  }, [db, kind, storyId]);

  useEntityInitialLoad(reload);
  useArcChangeReload(storyId, kind, reload);

  return arcIds;
}
