import type { ShowcaseAuthorPage } from '@keres/shared';
import { useMemo } from 'react';
import type { ServerSelect } from '@/src/db/schemas/servers';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import { publicationApiService } from '@/src/services/api/PublicationApiService';

/**
 * What a friend has on show on their server's public site: their author page, `null` while it is read and
 * when there is none (the showcase is off, they have published nothing, or the server cannot be reached).
 * The page is public, so it is asked of any friendship, not only of a friend. Read again whenever
 * `refreshKey` changes, as `useFriendActivity` is.
 */
export function useFriendAuthorPage(
  server: ServerSelect | null,
  username: string | null,
  refreshKey: unknown,
): ShowcaseAuthorPage | null {
  const load = useMemo(
    () => (server && username ? () => publicationApiService.getAuthorPage(server, username) : null),
    [server, username],
  );
  return useLoadedResource<ShowcaseAuthorPage | null>({
    load,
    initial: null,
    refreshKey,
    label: 'the friend author page',
    quiet: true,
  }).data;
}
