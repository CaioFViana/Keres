import { useHeaderBackActionStore } from '@/src/state/ui/headerBackActionStore';
import { navigateAcrossStacks, navigatorWithRoute } from '@/src/utils/nav/stackNavigation';

/** A drawer showing `focused`, whose stack currently shows `screen`. */
function drawerOf(focused: string, screen?: { name: string; params?: object }) {
  const navigate = jest.fn();
  return {
    navigate,
    getParent: () => undefined,
    getState: () => ({
      index: 0,
      routeNames: ['MainDashboard', 'CustomizationStack', 'SongStack'],
      routes: [
        {
          name: focused,
          state: screen ? { index: 0, routes: [screen] } : undefined,
        },
      ],
    }),
  };
}

beforeEach(() => {
  useHeaderBackActionStore.setState({
    crossStackReturnAction: undefined,
    crossStackReturnScreen: undefined,
  });
});

describe('navigatorWithRoute', () => {
  it('finds the navigator above a stack that has the route', () => {
    const drawer = drawerOf('MainDashboard');
    const stack = {
      navigate: jest.fn(),
      getState: () => ({ index: 0, routeNames: ['CustomizationIndex'], routes: [] }),
      getParent: () => drawer,
    };

    expect(navigatorWithRoute(stack, 'CustomizationStack')).toBe(drawer);
  });

  it('uses the navigation it was given when no navigator is told apart by its routes', () => {
    const plain = { navigate: jest.fn(), getState: () => undefined, getParent: () => undefined };

    expect(navigatorWithRoute(plain, 'CustomizationStack')).toBe(plain);
  });
});

describe('navigateAcrossStacks', () => {
  it('opens the screen in the other stack', () => {
    const drawer = drawerOf('MainDashboard');

    navigateAcrossStacks(drawer, {
      stack: 'CustomizationStack',
      screen: 'StoryArcForm',
      params: { arcId: 'a' },
    });

    expect(drawer.navigate).toHaveBeenCalledWith('CustomizationStack', {
      screen: 'StoryArcForm',
      params: { arcId: 'a' },
    });
  });

  it('registers the way back to the screen it left, for the screen it opens', () => {
    const drawer = drawerOf('MainDashboard', { name: 'Overview', params: { x: 1 } });

    navigateAcrossStacks(drawer, { stack: 'CustomizationStack', screen: 'StoryArcForm' });

    const store = useHeaderBackActionStore.getState();
    expect(store.crossStackReturnScreen).toBe('StoryArcForm');
    drawer.navigate.mockClear();
    store.consumeCrossStackReturnAction('StoryArcForm')?.();
    expect(drawer.navigate).toHaveBeenCalledWith('MainDashboard', {
      screen: 'Overview',
      params: { x: 1 },
    });
  });

  it('keeps the way back for the screen it was registered for, not for one opened from it', () => {
    const drawer = drawerOf('MainDashboard');
    navigateAcrossStacks(drawer, { stack: 'CustomizationStack', screen: 'StoryArcList' });

    // A form opened from the list: its back is the stack's own, and the list still owes the way back.
    expect(useHeaderBackActionStore.getState().consumeCrossStackReturnAction('StoryArcForm')).toBe(
      undefined,
    );
    expect(
      useHeaderBackActionStore.getState().consumeCrossStackReturnAction('StoryArcList'),
    ).toBeInstanceOf(Function);
  });

  it('registers nothing for a screen of the stack it is already in', () => {
    const drawer = drawerOf('CustomizationStack', { name: 'StoryArcList' });

    navigateAcrossStacks(drawer, { stack: 'CustomizationStack', screen: 'StoryArcForm' });

    expect(useHeaderBackActionStore.getState().crossStackReturnAction).toBeUndefined();
    expect(drawer.navigate).toHaveBeenCalledWith('CustomizationStack', {
      screen: 'StoryArcForm',
      params: undefined,
    });
  });

  it('lets the caller say where back goes instead', () => {
    const drawer = drawerOf('MainDashboard');
    const onReturn = jest.fn();

    navigateAcrossStacks(drawer, { stack: 'SongStack', screen: 'SongEditor' }, { onReturn });

    expect(useHeaderBackActionStore.getState().consumeCrossStackReturnAction('SongEditor')).toBe(
      onReturn,
    );
  });

  describe('fresh', () => {
    const drawer = () => ({
      navigate: jest.fn(),
      getParent: () => undefined,
      getState: () => ({
        index: 0,
        routes: [{ name: 'MainDashboard' }, { name: 'CharactersStack' }],
      }),
    });

    it('asks the stack to start over with the target as its only screen', () => {
      const navigation = drawer();

      navigateAcrossStacks(
        navigation,
        { stack: 'CharactersStack', screen: 'CharacterForm', params: { characterId: 'c1' } },
        { fresh: true },
      );

      // The `state` param resets a stack that has drawn and seeds one that has not. Nothing of the
      // stack's own state is read: the drawer reports it only for the route in focus.
      expect(navigation.navigate).toHaveBeenCalledWith('CharactersStack', {
        state: { index: 0, routes: [{ name: 'CharacterForm', params: { characterId: 'c1' } }] },
      });
    });

    it('pushes onto what the stack last showed when not asked', () => {
      const navigation = drawer();

      navigateAcrossStacks(navigation, { stack: 'CharactersStack', screen: 'CharacterForm' });

      expect(navigation.navigate).toHaveBeenCalledWith('CharactersStack', {
        screen: 'CharacterForm',
        params: undefined,
      });
    });
  });
});

describe('the way back in the header store', () => {
  it('is taken once', () => {
    const action = jest.fn();
    useHeaderBackActionStore.getState().setCrossStackReturnAction(action, 'A');

    expect(useHeaderBackActionStore.getState().consumeCrossStackReturnAction('A')).toBe(action);
    expect(useHeaderBackActionStore.getState().consumeCrossStackReturnAction('A')).toBeUndefined();
  });

  it('is taken by anyone when it was registered for no screen in particular', () => {
    const action = jest.fn();
    useHeaderBackActionStore.getState().setCrossStackReturnAction(action);

    expect(useHeaderBackActionStore.getState().consumeCrossStackReturnAction('Anything')).toBe(
      action,
    );
  });
});
