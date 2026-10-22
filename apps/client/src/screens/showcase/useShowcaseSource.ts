import { useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { ShowcaseSourceParams } from '@/src/navigation/stacks/StorySelectionStack';
import type { ShowcaseSource } from '@/src/services/api/ShowcaseApiService';
import { createServerService } from '@/src/services/servers/ServerService';
import { logger } from '@/src/utils/logging/logger';

export interface ShowcaseSourceState {
  source: ShowcaseSource | null;
  loading: boolean;
  /** The registered server the screen was opened for is no longer there. */
  missing: boolean;
}

/**
 * Whose showcase a screen shows, read from its route: a registered server (loaded from the local database)
 * or the origin of a server the person only had a link to, which needs no loading.
 */
export function useShowcaseSource({
  serverId,
  guestOrigin,
}: ShowcaseSourceParams): ShowcaseSourceState {
  const db = useDrizzle();
  const [server, setServer] = useState<{ id: string; found: ShowcaseSource | null } | null>(null);

  useEffect(() => {
    if (guestOrigin || !serverId) return undefined;
    let cancelled = false;
    createServerService(db)
      .getServerById(serverId)
      .then((found) => {
        if (!cancelled)
          setServer({ id: serverId, found: found ? { kind: 'server', server: found } : null });
      })
      .catch((error) => {
        logger.error('useShowcaseSource: failed to load the server.', error);
        if (!cancelled) setServer({ id: serverId, found: null });
      });
    return () => {
      cancelled = true;
    };
  }, [db, serverId, guestOrigin]);

  return useMemo(() => {
    if (guestOrigin)
      return { source: { kind: 'guest', origin: guestOrigin }, loading: false, missing: false };
    const loaded = server && server.id === serverId ? server : null;
    return {
      source: loaded?.found ?? null,
      loading: !loaded,
      missing: !!loaded && !loaded.found,
    };
  }, [guestOrigin, server, serverId]);
}
