import { useEffect } from 'react';
import { entityEventEmitter } from '@/src/utils/EventEmitter';

/** Calls `reload` when the tags of this story, or what they are attached to, change. */
export function useTagChangeReload(storyId: string | undefined, reload: () => unknown): void {
  useEffect(() => {
    const refreshTags = (changedStoryId: string) => {
      if (changedStoryId === storyId) reload();
    };
    entityEventEmitter.on('tag_changed', refreshTags);
    entityEventEmitter.on('tag_relation_changed', refreshTags);
    return () => {
      entityEventEmitter.off('tag_changed', refreshTags);
      entityEventEmitter.off('tag_relation_changed', refreshTags);
    };
  }, [reload, storyId]);
}
