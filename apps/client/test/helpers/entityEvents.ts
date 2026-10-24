import { act } from '@testing-library/react-native';
import type { EntityEventName, EntityEventPayloads } from '@/src/state/events/entityEvents';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';

/**
 * Reports an entity change the way the app does, through the real emitter, and lets whatever
 * reloads because of it settle. Tests drive a screen's refresh with this instead of reaching into
 * the hook that subscribes, so they keep passing when the subscription moves somewhere else.
 */
export async function emitEntityEvent<E extends EntityEventName>(
  event: E,
  ...payload: EntityEventPayloads[E]
): Promise<void> {
  await act(async () => {
    entityEventEmitter.emit(event, ...payload);
  });
}
