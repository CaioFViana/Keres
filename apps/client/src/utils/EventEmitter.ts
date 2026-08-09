
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

  async emitAsync(event: string, ...args: any[]): Promise<void> {
    if (!this.listeners[event]) return;
    await Promise.all(this.listeners[event].map((listener) => Promise.resolve(listener(...args))));
  }
}

export const entityEventEmitter = new EventEmitter();
// Values in use for the global entityEventEmitter.
// ----- Character  as example. all entities with CRUD/Menus have them -----
//  character_changed - Update character when crud happens or sync engine gets new info. Makes the characterdetail/list reloads it, if on that screen
//
// `*_navigation_reset` events used to exist here too (reset an entity's stack to its list
// screen when the drawer tab changed), fired on the Drawer.Screen's `blur`. Removed: `blur`
// fires on *any* navigation away from the stack, including the cross-entity jumps
// GenericRelationDisplay/RelationManager now do (Character -> Item, Scene -> Location...),
// which reset stacks that shouldn't have been touched and broke back-navigation. Each
// Drawer.Screen in MainSystemStack.tsx/StorySelectionStack.tsx now resets its own stack
// directly from `drawerItemPress` (fired only when the user taps that item in the drawer) -
// see the comment there.
