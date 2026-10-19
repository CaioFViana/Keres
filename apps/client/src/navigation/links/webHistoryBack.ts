/**
 * The browser's Back button, for the web build.
 *
 * The navigation container has no `linking`, so a screen opened inside the app adds nothing to the
 * browser's history: Back left the site from wherever the person was. Each time the app has a screen
 * to go back to, one history entry is put in front of the browser's, and when Back lands on the entry
 * beneath it, the app goes back instead. At the first screen nothing is added, so Back leaves as it did.
 */

export interface BackTarget {
  canGoBack(): boolean;
  addListener(type: 'state', callback: () => void): () => void;
}

export interface HistoryWindow {
  history: { pushState(data: unknown, unused: string): void };
  addEventListener(type: 'popstate', listener: () => void): void;
  removeEventListener(type: 'popstate', listener: () => void): void;
}

/** Starts following the app's navigation; returns what stops it. */
export function attachWebHistoryBack(
  target: BackTarget,
  win: HistoryWindow,
  goBack: () => void,
): () => void {
  // Whether an entry of the app's is on top of the browser's history right now.
  let entryPushed = false;

  const sync = () => {
    if (entryPushed || !target.canGoBack()) return;
    win.history.pushState({ keres: 'back' }, '');
    entryPushed = true;
  };

  const onPop = () => {
    // Back from an entry the app did not push (the first screen's own) is the browser's to handle.
    if (!entryPushed) return;
    entryPushed = false;
    goBack();
    // Going back changes the navigation state, which puts a new entry up while there is still a screen
    // to go back to; a back that changed nothing does it here.
    sync();
  };

  const stopListening = target.addListener('state', sync);
  win.addEventListener('popstate', onPop);
  sync();

  return () => {
    stopListening();
    win.removeEventListener('popstate', onPop);
  };
}

interface NavigationStateNode {
  type?: string;
  index?: number;
  routes: { name: string; state?: NavigationStateNode }[];
}

/**
 * Whether the screen in front has one behind it that the header's back arrow would return to: some
 * stack on the way down to it holds more than its first screen. The menu's own history does not
 * count - a screen opened from the menu is a root, with no arrow, and Back there leaves the site.
 */
export function hasScreenBehind(state: NavigationStateNode | undefined): boolean {
  let node = state;
  while (node) {
    const index = node.index ?? 0;
    if (node.type === 'stack' && index > 0) return true;
    node = node.routes[index]?.state;
  }
  return false;
}
