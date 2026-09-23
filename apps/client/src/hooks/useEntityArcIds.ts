import { useCallback, useEffect, useState } from 'react';
import { useDrizzle } from '@/src/db';
import { useEntityInitialLoad } from '@/src/hooks/useEntityRefreshLifecycle';
import {
  createStoryArcService,
  type ArcMembershipKind,
} from '@/src/services/storymanagement/StoryArcService';
import { entityEventEmitter } from '@/src/utils/EventEmitter';

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

  return arcIds;
}
