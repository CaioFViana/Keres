import { useEffect } from 'react';
import { entityEventEmitter } from '@/src/utils/EventEmitter';

export interface EntityEventSubscription {
  event: string;
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
