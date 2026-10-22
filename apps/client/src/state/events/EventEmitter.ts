import { logger } from '@/src/utils/logging/logger';
import type { EntityEventName, EntityEventPayloads } from './entityEvents';

/** A listener may be `async`: `emit` does not wait for it, but a rejection is logged, not lost. */
type Listener<E extends EntityEventName> = (
  ...args: EntityEventPayloads[E]
) => void | Promise<void>;

/**
 * The app's global event bus. Events and their arguments are declared in `entityEvents.ts`; nothing
 * outside that map can be emitted or listened to.
 */
class EventEmitter {
  private listeners: { [event: string]: ((...args: never[]) => void)[] } = {};

  on<E extends EntityEventName>(event: E, listener: Listener<E>) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener as (...args: never[]) => void);
  }

  off<E extends EntityEventName>(event: E, listener: Listener<E>) {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event] = this.listeners[event].filter((l) => l !== listener);
  }

  emit<E extends EntityEventName>(event: E, ...args: EntityEventPayloads[E]) {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event].forEach((listener) => {
      const result = (listener as Listener<E>)(...args);
      if (result instanceof Promise) {
        result.catch((error) => logger.error(`A listener of '${event}' failed:`, error));
      }
    });
  }

  async emitAsync<E extends EntityEventName>(
    event: E,
    ...args: EntityEventPayloads[E]
  ): Promise<void> {
    if (!this.listeners[event]) return;
    await Promise.all(
      this.listeners[event].map((listener) => Promise.resolve((listener as Listener<E>)(...args))),
    );
  }
}

export const entityEventEmitter = new EventEmitter();

// `*_navigation_reset` events used to exist here too (reset an entity's stack to its list
// screen when the drawer tab changed), fired on the Drawer.Screen's `blur`. Removed: `blur`
// fires on *any* navigation away from the stack, including the cross-entity jumps
// GenericRelationDisplay/RelationManager now do (Character -> Item, Scene -> Location...),
// which reset stacks that shouldn't have been touched and broke back-navigation. Each
// Drawer.Screen in MainSystemDrawer.tsx/StorySelectionStack.tsx now resets its own stack
// directly from `drawerItemPress` (fired only when the user taps that item in the drawer) -
// see the comment there.
