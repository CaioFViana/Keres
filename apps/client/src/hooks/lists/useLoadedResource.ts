import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EntityEventName } from '@/src/state/events/entityEvents';
import { logger } from '@/src/utils/logging/logger';
import { useEntityEventSubscriptions, useEntityInitialLoad } from './useEntityRefreshLifecycle';

const NO_EVENTS: readonly EntityEventName[] = [];

interface LoadedResourceOptions<T> {
  /**
   * Reads the resource. A new identity means a new resource to read (another story, another id), so
   * it must be stable between renders; `null` means there is nothing to read. It is handed the
   * current `refreshKey`, for a read that depends on something that changes while the data stays
   * on screen.
   */
  load: ((refreshKey: unknown) => Promise<T>) | null;
  /** What shows until the current resource is read, and while there is nothing to read. Must be stable. */
  initial: T;
  /** Events that reload the resource. Must be stable. */
  events?: readonly EntityEventName[];
  /** With `events`: only changes reported for this story reload it. */
  storyId?: string;
  /** With `events`: only changes naming this entity reload it (an event naming none counts as naming all). */
  entityId?: string;
  /** Reads the resource again (silently, keeping what shows) whenever this changes; `load` receives it. */
  refreshKey?: unknown;
  /** Names the resource in the log line when a read fails. */
  label: string;
  /** A failure is expected now and then (a server that cannot be reached): log it as debug, not error. */
  quiet?: boolean;
}

/**
 * A read-only resource kept fresh by entity events: the shared shape of every "read it, show it,
 * read it again when something changes" hook.
 *
 * - `loading` is true only until the current resource has been read once; a reload after an event
 *   is silent and the old data stays on screen until the new data lands.
 * - A read that answers after a newer one (or after `load` changed, or the screen left) is dropped,
 *   and data read for an older `load` is never shown for a newer one.
 * - A failed read is logged and keeps what was read before (or `initial` if nothing was, with
 *   `failed` set and the `error` kept, so "nothing" is not mistaken for "empty").
 */
export function useLoadedResource<T>({
  load,
  initial,
  events = NO_EVENTS,
  storyId,
  entityId,
  refreshKey,
  label,
  quiet = false,
}: LoadedResourceOptions<T>) {
  const [settled, setSettled] = useState<{
    load: unknown;
    data: T;
    failed: boolean;
    error: unknown;
  } | null>(null);
  const generation = useRef(0);

  const reload = useCallback(async () => {
    if (!load) return;
    const current = ++generation.current;
    try {
      const data = await load(refreshKey);
      if (current === generation.current) setSettled({ load, data, failed: false, error: null });
    } catch (error) {
      (quiet ? logger.debug : logger.error)(`Failed to fetch ${label}:`, error);
      if (current === generation.current) {
        setSettled((previous) =>
          previous?.load === load ? previous : { load, data: initial, failed: true, error },
        );
      }
    }
  }, [load, refreshKey, initial, label, quiet]);

  useEntityInitialLoad(reload);
  // Whatever is still in flight when the resource changes or the screen leaves no longer counts.
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [reload],
  );

  /** Forgets what was read and reads again, back to "loading": the retry of a failed read. */
  const retry = useCallback(() => {
    setSettled(null);
    void reload();
  }, [reload]);

  const subscriptions = useMemo(
    () =>
      events.map((event) => ({
        event,
        listener: (changedStoryId?: string, changedEntityId?: string) => {
          if (storyId !== undefined && changedStoryId !== storyId) return;
          if (
            entityId !== undefined &&
            changedEntityId !== undefined &&
            changedEntityId !== entityId
          ) {
            return;
          }
          void reload();
        },
      })),
    [events, storyId, entityId, reload],
  );
  useEntityEventSubscriptions(subscriptions);

  const current = load && settled?.load === load ? settled : null;
  return {
    data: current ? current.data : initial,
    loading: load !== null && current === null,
    failed: current?.failed ?? false,
    error: current?.error ?? null,
    reload,
    retry,
  };
}
