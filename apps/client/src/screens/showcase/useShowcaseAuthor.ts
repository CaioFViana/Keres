import type { ShowcaseAuthorPage } from '@keres/shared';
import { useMemo } from 'react';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import { showcaseApiService, type ShowcaseSource } from '@/src/services/api/ShowcaseApiService';
import { showcaseReadFailure } from './showcaseReadStatus';

export type ShowcaseAuthorState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'unreachable' }
  | { status: 'failed' }
  | { status: 'ready'; page: ShowcaseAuthorPage };

/** An author's page of a server's public site: who they are in their own words and what they have on show. */
export function useShowcaseAuthor(
  source: ShowcaseSource | null,
  username: string,
): ShowcaseAuthorState {
  const load = useMemo(
    () => (source ? () => showcaseApiService.getAuthor(source, username) : null),
    [source, username],
  );
  const { data, failed, error } = useLoadedResource<ShowcaseAuthorPage | null>({
    load,
    initial: null,
    label: 'the author page',
    quiet: true,
  });

  return useMemo(
    () =>
      data
        ? { status: 'ready', page: data }
        : failed
          ? { status: showcaseReadFailure(error) }
          : { status: 'loading' },
    [data, failed, error],
  );
}
