import type { ShowcaseAuthorPage } from '@keres/shared';
import { useEffect, useState } from 'react';
import { isNotFoundError, isOfflineError } from '@/src/services/api/apiClient';
import { showcaseApiService, type ShowcaseSource } from '@/src/services/api/ShowcaseApiService';
import { logger } from '@/src/utils/logging/logger';

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
  const [state, setState] = useState<ShowcaseAuthorState>({ status: 'loading' });

  useEffect(() => {
    if (!source) return undefined;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- going back to "loading" belongs to starting the read.
    setState({ status: 'loading' });
    showcaseApiService
      .getAuthor(source, username)
      .then((page) => !cancelled && setState({ status: 'ready', page }))
      .catch((error) => {
        if (cancelled) return;
        logger.debug('useShowcaseAuthor: could not read the page.', error);
        setState({
          status: isNotFoundError(error)
            ? 'not_found'
            : isOfflineError(error)
              ? 'unreachable'
              : 'failed',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [source, username]);

  return state;
}
