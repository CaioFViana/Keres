import { attachWebHistoryBack, hasScreenBehind } from '@/src/navigation/links/webHistoryBack';

/** A browser window and a navigation container reduced to what the history follower touches. */
function setup(initialCanGoBack = false) {
  let canGoBack = initialCanGoBack;
  const stateListeners = new Set<() => void>();
  const popListeners = new Set<() => void>();
  const pushed: unknown[] = [];

  const target = {
    canGoBack: () => canGoBack,
    addListener: (_type: 'state', callback: () => void) => {
      stateListeners.add(callback);
      return () => stateListeners.delete(callback);
    },
  };
  const win = {
    history: { pushState: (data: unknown) => pushed.push(data) },
    addEventListener: (_type: 'popstate', listener: () => void) => popListeners.add(listener),
    removeEventListener: (_type: 'popstate', listener: () => void) => popListeners.delete(listener),
  };
  return {
    target,
    win,
    pushed,
    stateListeners,
    popListeners,
    /** The app moved: it now has (or no longer has) a screen to go back to. */
    navigate: (next: boolean) => {
      canGoBack = next;
      for (const listener of [...stateListeners]) listener();
    },
    /** The person pressed the browser's Back button. */
    pressBack: () => {
      for (const listener of [...popListeners]) listener();
    },
  };
}

describe('attachWebHistoryBack', () => {
  it('adds nothing to the history while the app is on its first screen', () => {
    const env = setup(false);
    attachWebHistoryBack(env.target, env.win, jest.fn());

    expect(env.pushed).toHaveLength(0);
  });

  it('puts one entry up when the app gets a screen to go back to, and only one', () => {
    const env = setup(false);
    attachWebHistoryBack(env.target, env.win, jest.fn());

    env.navigate(true);
    env.navigate(true);

    expect(env.pushed).toHaveLength(1);
  });

  it('puts one up at once when it is attached on a screen that already has one behind it', () => {
    const env = setup(true);
    attachWebHistoryBack(env.target, env.win, jest.fn());

    expect(env.pushed).toHaveLength(1);
  });

  it('goes back in the app when the browser lands on the entry beneath its own', () => {
    const env = setup(false);
    const goBack = jest.fn();
    attachWebHistoryBack(env.target, env.win, goBack);
    env.navigate(true);

    env.pressBack();

    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('puts a new entry up after going back while another screen is still behind', () => {
    const env = setup(false);
    const goBack = jest.fn(() => env.navigate(true));
    attachWebHistoryBack(env.target, env.win, goBack);
    env.navigate(true);

    env.pressBack();

    expect(env.pushed).toHaveLength(2);
  });

  it('puts none up once the app is back on its first screen, so the next Back leaves', () => {
    const env = setup(false);
    const goBack = jest.fn(() => env.navigate(false));
    attachWebHistoryBack(env.target, env.win, goBack);
    env.navigate(true);

    env.pressBack();
    env.pressBack();

    expect(env.pushed).toHaveLength(1);
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('leaves a Back that no entry of the app was behind to the browser', () => {
    const env = setup(false);
    const goBack = jest.fn();
    attachWebHistoryBack(env.target, env.win, goBack);

    env.pressBack();

    expect(goBack).not.toHaveBeenCalled();
  });

  it('stops following when detached', () => {
    const env = setup(false);
    const goBack = jest.fn();
    const detach = attachWebHistoryBack(env.target, env.win, goBack);

    detach();
    env.navigate(true);
    env.pressBack();

    expect(env.pushed).toHaveLength(0);
    expect(goBack).not.toHaveBeenCalled();
    expect(env.stateListeners.size).toBe(0);
    expect(env.popListeners.size).toBe(0);
  });
});

describe('hasScreenBehind', () => {
  const stack = (index: number, ...names: string[]) => ({
    type: 'stack',
    index,
    routes: names.map((name) => ({ name })),
  });

  it('is false with nothing to read', () => {
    expect(hasScreenBehind(undefined)).toBe(false);
  });

  it('is false on the first screen of every stack on the way down', () => {
    const state = {
      type: 'stack',
      index: 0,
      routes: [
        {
          name: 'MainSystem',
          state: {
            type: 'drawer',
            index: 1,
            routes: [{ name: 'A' }, { name: 'Characters', state: stack(0, 'CharacterList') }],
          },
        },
      ],
    };

    expect(hasScreenBehind(state)).toBe(false);
  });

  it('is true when a stack on the way down is on a later screen', () => {
    const state = {
      type: 'stack',
      index: 0,
      routes: [
        {
          name: 'MainSystem',
          state: {
            type: 'drawer',
            index: 0,
            routes: [{ name: 'Characters', state: stack(1, 'CharacterList', 'CharacterDetail') }],
          },
        },
      ],
    };

    expect(hasScreenBehind(state)).toBe(true);
  });

  it('does not count the menu: a drawer that has been somewhere else before is not a screen behind', () => {
    const state = {
      type: 'drawer',
      index: 2,
      routes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    };

    expect(hasScreenBehind(state)).toBe(false);
  });
});
