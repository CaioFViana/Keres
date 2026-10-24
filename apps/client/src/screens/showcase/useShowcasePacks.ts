import type { ShowcasePackCard, ShowcasePackDetail } from '@keres/shared';
import { useMemo } from 'react';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import { showcaseApiService, type ShowcaseSource } from '@/src/services/api/ShowcaseApiService';
import { showcaseReadFailure } from './showcaseReadStatus';

const NO_PACKS: ShowcasePackCard[] = [];

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
  const load = useMemo(
    () => (source && enabled ? () => showcaseApiService.listPacks(source) : null),
    [source, enabled],
  );
  const {
    data: packs,
    loading,
    failed,
    retry,
  } = useLoadedResource({ load, initial: NO_PACKS, label: 'the packs', quiet: true });

  return { packs, loading, failed, reload: retry };
}

export type ShowcasePackState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'unreachable' }
  | { status: 'failed' }
  | { status: 'ready'; pack: ShowcasePackDetail };

/** One pack of a server's public site, whole and checked, ready to be installed. */
export function useShowcasePack(source: ShowcaseSource | null, packId: string): ShowcasePackState {
  const load = useMemo(
    () => (source ? () => showcaseApiService.getPack(source, packId) : null),
    [source, packId],
  );
  const { data, failed, error } = useLoadedResource<ShowcasePackDetail | null>({
    load,
    initial: null,
    label: 'the pack',
    quiet: true,
  });

  return useMemo<ShowcasePackState>(
    () =>
      data
        ? { status: 'ready', pack: data }
        : failed
          ? { status: showcaseReadFailure(error) }
          : { status: 'loading' },
    [data, failed, error],
  );
}
