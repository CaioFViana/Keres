import { useEffect } from 'react';
import type { ArcMembershipKind } from '@/src/services/storymanagement/scenes-chapters/StoryArcService';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';
import type { EntityChangeEvent } from '@/src/state/events/entityEvents';

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
    const events: EntityChangeEvent[] = ['story_arc_changed', 'chapter_changed', 'scene_changed'];
    if (kind === 'character') events.push('character_scene_changed');
    if (kind === 'item') events.push('item_journey_changed');
    // The events differ in what follows the story id; this reload needs only the id.
    const handler = (changedStoryId: string, ..._details: unknown[]) => {
      if (changedStoryId === storyId) void reload();
    };
    for (const event of events) entityEventEmitter.on(event, handler);
    return () => {
      for (const event of events) entityEventEmitter.off(event, handler);
    };
  }, [kind, reload, storyId]);
}
