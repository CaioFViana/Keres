import { useEffect } from 'react';
import type { EntityEventName } from '@/src/state/events/entityEvents';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';

export interface EntityEventSubscription {
  event: EntityEventName;
  // The payload depends on `event`, and a list of subscriptions mixes events, which a single listener
  // type cannot correlate.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listener: (...args: any[]) => void;
}

/**
 * Standard lifecycle for screens that display locally cached entities.
 *
 * Loading and event subscription must remain separate effects. A listener may need a new callback
 * after state changes; that is harmless. Letting that re-subscription invoke the initial loader is
 * how a freshly fetched object can recursively reload its own detail screen.
 */
export function useEntityInitialLoad(load: () => void | Promise<void>): void {
  useEffect(() => {
    void load();
  }, [load]);
}

export function useEntityEventSubscriptions(
  subscriptions: readonly EntityEventSubscription[],
): void {
  useEffect(() => {
    for (const { event, listener } of subscriptions) entityEventEmitter.on(event, listener);
    return () => {
      for (const { event, listener } of subscriptions) entityEventEmitter.off(event, listener);
    };
  }, [subscriptions]);
}
