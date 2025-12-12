
class EventEmitter {
  private listeners: { [event: string]: Function[] } = {};

  on(event: string, listener: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  off(event: string, listener: Function) {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event] = this.listeners[event].filter(l => l !== listener);
  }

  emit(event: string, ...args: any[]) {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event].forEach(listener => listener(...args));
  }
}

export const entityEventEmitter = new EventEmitter();
// Values in use for the global entityEventEmitter.
// ----- Character -----
//  character_changed - Update character when crud happens or sync engine gets new info. Makes the characterdetail/list reloads it, if on that screen
//  character_navigation_reset - Part of the navigation. Resets character stack to starter position if drawer tab changes. avoid some bugs + cleaner nav.
// TODO - Add all others. with time...
