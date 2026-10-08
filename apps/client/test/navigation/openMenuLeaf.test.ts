import type { MenuLeaf } from '../../src/navigation/mainDrawerMenu';
import { nestedFocusOf, openMenuLeaf } from '../../src/navigation/openMenuLeaf';

const stateOf = (routes: object[], index = 0) => ({ index, routes }) as never;

function drawer(prevented: boolean) {
  return {
    emit: jest.fn(() => ({ defaultPrevented: prevented })),
    navigate: jest.fn(),
    dispatch: jest.fn(),
    closeDrawer: jest.fn(),
  } as never as {
    emit: jest.Mock;
    navigate: jest.Mock;
    dispatch: jest.Mock;
    closeDrawer: jest.Mock;
  };
}

const plain: MenuLeaf = {
  id: 'ItemsStack',
  route: 'ItemsStack',
  label: 'Items',
  icon: 'cube-outline',
};
const manuscript: MenuLeaf = {
  id: 'Manuscript',
  route: 'NarrativeElementsStack',
  label: 'Manuscript',
  icon: 'book-outline',
  target: { screen: 'Manuscript' },
};

describe('openMenuLeaf', () => {
  it('lets the drawer entry return its own stack to the list', () => {
    const navigation = drawer(true);

    openMenuLeaf(navigation as never, stateOf([{ name: 'ItemsStack', key: 'items-key' }]), plain);

    expect(navigation.emit).toHaveBeenCalledWith({
      type: 'drawerItemPress',
      target: 'items-key',
      canPreventDefault: true,
    });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('goes to the route itself when nobody took the press', () => {
    const navigation = drawer(false);

    openMenuLeaf(navigation as never, stateOf([{ name: 'ItemsStack', key: 'items-key' }]), plain);

    expect(navigation.navigate).toHaveBeenCalledWith('ItemsStack');
    expect(navigation.closeDrawer).toHaveBeenCalledTimes(1);
  });

  it('replaces what the stack held with the one screen, then shows it', () => {
    const navigation = drawer(true);
    const state = stateOf([
      { name: 'NarrativeElementsStack', key: 'narrative-key', state: { key: 'nested-key' } },
    ]);

    openMenuLeaf(navigation as never, state, manuscript);

    expect(navigation.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RESET',
        target: 'nested-key',
        payload: expect.objectContaining({
          index: 0,
          routes: [{ name: 'Manuscript', params: undefined }],
        }),
      }),
    );
    expect(navigation.navigate).toHaveBeenCalledWith('NarrativeElementsStack', {
      screen: 'Manuscript',
      params: undefined,
    });
    expect(navigation.closeDrawer).toHaveBeenCalledTimes(1);
  });

  it('only navigates when the stack has not been opened yet', () => {
    const navigation = drawer(true);

    openMenuLeaf(
      navigation as never,
      stateOf([{ name: 'NarrativeElementsStack', key: 'narrative-key' }]),
      manuscript,
    );

    expect(navigation.dispatch).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
  });

  it('carries the params of the target, as the world categories need', () => {
    const navigation = drawer(true);
    const fauna: MenuLeaf = {
      id: 'WorldRulesStack:fauna',
      route: 'WorldRulesStack',
      label: 'Bestiary',
      icon: 'paw-outline',
      target: { screen: 'WorldRules', params: { section: 'fauna' } },
    };

    openMenuLeaf(
      navigation as never,
      stateOf([{ name: 'WorldRulesStack', key: 'world-key' }]),
      fauna,
    );

    expect(navigation.navigate).toHaveBeenCalledWith('WorldRulesStack', {
      screen: 'WorldRules',
      params: { section: 'fauna' },
    });
  });
});

describe('nestedFocusOf', () => {
  it('reads the screen on show from the navigator inside the focused entry', () => {
    const state = stateOf(
      [
        { name: 'MainDashboard' },
        {
          name: 'WorldRulesStack',
          state: {
            index: 1,
            routes: [{ name: 'WorldRules' }, { name: 'WorldRuleDetail', params: { a: 1 } }],
          },
        },
      ],
      1,
    );

    expect(nestedFocusOf(state)).toEqual({
      route: 'WorldRulesStack',
      focus: { screen: 'WorldRuleDetail', params: { a: 1 } },
    });
  });

  it('falls back to the screen the entry was asked to open before it has drawn', () => {
    const state = stateOf([
      { name: 'WorldRulesStack', params: { screen: 'WorldRules', params: { section: 'fauna' } } },
    ]);

    expect(nestedFocusOf(state)).toEqual({
      route: 'WorldRulesStack',
      focus: { screen: 'WorldRules', params: { section: 'fauna' } },
    });
  });

  it('knows nothing more about an entry with no navigator inside', () => {
    expect(nestedFocusOf(stateOf([{ name: 'MainDashboard' }]))).toEqual({
      route: 'MainDashboard',
      focus: { screen: undefined, params: undefined },
    });
  });
});
