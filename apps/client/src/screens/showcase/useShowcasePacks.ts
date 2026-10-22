import type { ShowcasePackCard, ShowcasePackDetail } from '@keres/shared';
import { useCallback, useEffect, useState } from 'react';
import { isNotFoundError, isOfflineError } from '@/src/services/api/apiClient';
import { showcaseApiService, type ShowcaseSource } from '@/src/services/api/ShowcaseApiService';
import { logger } from '@/src/utils/logging/logger';

export interface ShowcasePacksHandle {
  packs: ShowcasePackCard[];
  loading: boolean;
  failed: boolean;
  reload: () => void;
}

/**
 * The packs on show on a server. The server hands them out whole (it has few, and they are small), so there are
 * no pages: the screen narrows them as the person searches.
 */
export function useShowcasePacks(
  source: ShowcaseSource | null,
  enabled: boolean,
): ShowcasePacksHandle {
  const [packs, setPacks] = useState<ShowcasePackCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (!source || !enabled) return undefined;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starting the read of the list.
    setLoading(true);
    setFailed(false);
    showcaseApiService
      .listPacks(source)
      .then((found) => !cancelled && setPacks(found))
      .catch((error) => {
        if (cancelled) return;
        logger.debug('useShowcasePacks: could not read the packs.', error);
        setPacks([]);
        setFailed(true);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [source, enabled, reloads]);

  const reload = useCallback(() => setReloads((count) => count + 1), []);
  return { packs, loading, failed, reload };
}

export type ShowcasePackState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'unreachable' }
  | { status: 'failed' }
  | { status: 'ready'; pack: ShowcasePackDetail };

/** One pack of a server's public site, whole and checked, ready to be installed. */
export function useShowcasePack(source: ShowcaseSource | null, packId: string): ShowcasePackState {
  const [state, setState] = useState<ShowcasePackState>({ status: 'loading' });

  useEffect(() => {
    if (!source) return undefined;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- going back to "loading" belongs to starting the read.
    setState({ status: 'loading' });
    showcaseApiService
      .getPack(source, packId)
      .then((pack) => !cancelled && setState({ status: 'ready', pack }))
      .catch((error) => {
        if (cancelled) return;
        logger.debug('useShowcasePack: could not read the pack.', error);
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
  }, [source, packId]);

  return state;
}
