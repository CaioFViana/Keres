import { useCallback, useEffect, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { StoryArcSelect } from '@/src/db/schema';
import { useEntityInitialLoad } from '@/src/hooks/useEntityRefreshLifecycle';
import { createStoryArcService } from '@/src/services/storymanagement/StoryArcService';
import { entityEventEmitter } from '@/src/utils/EventEmitter';

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

  useEffect(() => {
    const events = ['story_arc_changed', 'chapter_changed', 'scene_changed'];
    if (kind === 'character') events.push('character_scene_changed');
    if (kind === 'item') events.push('item_journey_changed');
    const handler = (changedStoryId: string) => {
      if (changedStoryId === storyId) void reload();
    };
    for (const event of events) entityEventEmitter.on(event, handler);
    return () => {
      for (const event of events) entityEventEmitter.off(event, handler);
    };
  }, [kind, reload, storyId]);

  return arcs;
}
