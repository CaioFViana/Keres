// apps/api/src/utils/EventManager.ts
import { logger } from './logger';

type EventCallback = (payload: never) => void;

class EventManager {
  private listeners: Map<string, EventCallback[]> = new Map();

  on(eventName: string, callback: EventCallback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName)?.push(callback);
  }

  off(eventName: string, callback: EventCallback) {
    const eventListeners = this.listeners.get(eventName);
    if (eventListeners) {
      this.listeners.set(
        eventName,
        eventListeners.filter((cb) => cb !== callback),
      );
    }
  }

  emit(eventName: string, payload: unknown) {
    const eventListeners = this.listeners.get(eventName);
    if (!eventListeners) {
      return;
    }
    // A listener is a socket `send` away from throwing: a connection that died between the TCP
    // close and the `close` handler still sits here until that handler runs. One broken socket
    // must neither starve the listeners behind it nor fail the HTTP push that emitted.
    for (const callback of eventListeners) {
      try {
        callback(payload as never);
      } catch (error) {
        logger.error(`EventManager: listener for "${eventName}" failed`, error);
      }
    }
  }
}

export const eventManager = new EventManager();
