import type { EffectiveStoryRole } from '@keres/shared';
import { useCallback, useEffect, useState } from 'react';
import { useDrizzle } from '../db';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useEntityInitialLoad } from './useEntityRefreshLifecycle';

/**
 * The current user's effective role on a story, kept fresh from `stories.myRole` (set the
 * moment a server-linked local row is created - see `StoryService.importFullStory` and
 * `SyncEngineService.uploadNewStoryToServer` - and refreshed on every sync pull thereafter).
 * A story with no `serverId` has never been linked to a server and can't have collaborators,
 * so it's always treated as owned.
 *
 * `canEdit` only allows a *positively known* `'owner'`/`'writer'` role - a server-linked story
 * whose role hasn't resolved yet (`myRole` still null) is treated as NOT editable rather than
 * defaulting to owner. The old fail-open default let a reader edit for as long as their local
 * copy hadn't completed a sync cycle, since "unknown" was silently treated as "owner".
 *
 * `canManageStoryPolicy` is stricter: only the owner may change story identity/policy (`type`,
 * `favoriteBehavior`, `allowReaderComments`) or delete/unlink the story. Writers keep content
 * editing; those fields are locked both here and in `StoryService`.
 */
export function useStoryRole(storyId: string | undefined | null): {
  role: EffectiveStoryRole | null;
  canEdit: boolean;
  canManageStoryPolicy: boolean;
  loading: boolean;
} {
  const drizzleDb = useDrizzle();
  const [role, setRole] = useState<EffectiveStoryRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async () => {
    if (!storyId) {
      setRole(null);
      setLoading(false);
      return;
    }
    try {
      const story = await drizzleDb.query.stories.findFirst({
        where: (stories, { eq }) => eq(stories.id, storyId),
        columns: { myRole: true, serverId: true },
      });
      setRole(!story?.serverId ? 'owner' : (story.myRole ?? null));
    } catch (error) {
      console.error(`Failed to load story role for ${storyId}:`, error);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, [drizzleDb, storyId]);

  useEntityInitialLoad(fetchRole);

  useEffect(() => {
    entityEventEmitter.on('story_role_changed', fetchRole);
    return () => {
      entityEventEmitter.off('story_role_changed', fetchRole);
    };
  }, [fetchRole]);

  return {
    role,
    canEdit: role === 'owner' || role === 'writer',
    canManageStoryPolicy: role === 'owner',
    loading,
  };
}
