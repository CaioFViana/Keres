import { eq } from 'drizzle-orm';
import { useEffect, useState } from 'react';
import { useDrizzle } from '../db';
import { servers, stories } from '../db/schema';
import type { ResolvedUserProfile } from './useUserProfileResolver';
import { useUserProfileResolver } from './useUserProfileResolver';

/** Resolves author profiles for a story's comments, using that story's server when needed. */
export function useAuthorProfiles(
  storyId: string | undefined,
  userIds: readonly string[],
  enabled = true,
): Record<string, ResolvedUserProfile> {
  const db = useDrizzle();
  const resolveProfile = useUserProfileResolver();
  const [profiles, setProfiles] = useState<Record<string, ResolvedUserProfile>>({});
  const idsKey = [...userIds].sort().join(',');

  useEffect(() => {
    if (!enabled || !storyId || !idsKey) {
      if (!enabled) return;
      setProfiles({});
      return;
    }
    let cancelled = false;
    (async () => {
      const story = await db.query.stories.findFirst({
        where: eq(stories.id, storyId),
        columns: { serverId: true },
      });
      const storyServer = story?.serverId
        ? await db.query.servers.findFirst({ where: eq(servers.id, story.serverId) })
        : undefined;
      const uniqueIds = idsKey ? idsKey.split(',') : [];
      const resolved = await Promise.all(
        uniqueIds.map((userId) => resolveProfile(userId, storyServer)),
      );
      if (!cancelled) {
        setProfiles(Object.fromEntries(resolved.map((profile) => [profile.id, profile])));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, enabled, idsKey, resolveProfile, storyId]);

  return profiles;
}
