// apps/api/src/utils/EventManager.ts

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
    if (eventListeners) {
      eventListeners.forEach((callback) => callback(payload as never));
    }
  }
}

export const eventManager = new EventManager();
