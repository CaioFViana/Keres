import type { ShowcaseAuthorPage } from '@keres/shared';
import { useEffect, useState } from 'react';
import type { ServerSelect } from '@/src/db/schemas/servers';
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
  const [page, setPage] = useState<ShowcaseAuthorPage | null>(null);

  useEffect(() => {
    if (!server || !username) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing what belongs to a friend who no longer applies.
      setPage(null);
      return undefined;
    }
    let cancelled = false;
    void publicationApiService.getAuthorPage(server, username).then((found) => {
      if (!cancelled) setPage(found);
    });
    return () => {
      cancelled = true;
    };
  }, [server, username, refreshKey]);

  return page;
}
