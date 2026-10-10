import { useEffect } from 'react';
import type { ArcMembershipKind } from '@/src/services/storymanagement/StoryArcService';
import { entityEventEmitter } from '@/src/utils/EventEmitter';

/**
 * Calls `reload` when the story's arcs, chapters or scenes change, and when the links of the given kind
 * do (a character's scene appearances, an item's journeys). Only events of this story reach it.
 */
export function useArcChangeReload(
  storyId: string,
  kind: ArcMembershipKind,
  reload: () => unknown,
): void {
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
}
