import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EntityEventName } from '@/src/state/events/entityEvents';
import { logger } from '@/src/utils/logging/logger';
import { useEntityEventSubscriptions, useEntityInitialLoad } from './useEntityRefreshLifecycle';

const NO_EVENTS: readonly EntityEventName[] = [];

type DetailRecordFailure = 'notFound' | 'failed';

interface DetailRecordOptions<T> {
  id: string;
  /** Reads the record. Must be stable (a service method already holds the database). */
  load: (id: string) => Promise<T | null | undefined>;
  /** The event that reports a change to this kind of record. */
  event: EntityEventName;
  /** Other events that also change what the record holds (its tags, say) when they name it. Must be stable. */
  alsoOn?: readonly EntityEventName[];
  /** Names the record in the log line when the read fails. */
  label: string;
  /** The record is gone (deleted here or elsewhere): leave the screen. */
  onGone: () => void;
}

/**
 * The record a detail screen shows, read once and kept fresh by its change event.
 *
 * Only the newest read may answer; an older one that lands after it (or after the screen left) is
 * dropped. The first read shows the loading state and reports why it failed; a refresh after an
 * event is silent, keeps the record on screen when the read fails, and leaves the screen when the
 * record has been deleted.
 */
export function useDetailRecord<T extends { isDeleted?: boolean | null }>({
  id,
  load,
  event,
  alsoOn = NO_EVENTS,
  label,
  onGone,
}: DetailRecordOptions<T>) {
  const [record, setRecord] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<DetailRecordFailure | null>(null);
  const request = useRef(0);

  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );

  const fetchRecord = useCallback(
    async (silent: boolean) => {
      const current = ++request.current;
      if (!silent) setLoading(true);
      try {
        const fetched = await load(id);
        if (current !== request.current) return;
        if (fetched && !fetched.isDeleted) {
          setRecord(fetched);
          setFailure(null);
        } else if (fetched || silent) {
          onGone();
        } else {
          setFailure('notFound');
        }
      } catch (error) {
        if (current !== request.current) return;
        logger.error(`Failed to fetch ${label}:`, error);
        if (!silent) setFailure('failed');
      } finally {
        if (current === request.current) setLoading(false);
      }
    },
    [id, load, label, onGone],
  );

  const loadRecord = useCallback(() => fetchRecord(false), [fetchRecord]);
  const handleChange = useCallback(
    (_changedStoryId: string, changedId?: string) => {
      if (changedId === id) void fetchRecord(true);
    },
    [id, fetchRecord],
  );

  useEntityInitialLoad(loadRecord);
  useEntityEventSubscriptions(
    useMemo(
      () => [
        { event, listener: handleChange },
        ...alsoOn.map((name) => ({ event: name, listener: handleChange })),
      ],
      [event, alsoOn, handleChange],
    ),
  );

  return { record, loading, failure };
}
