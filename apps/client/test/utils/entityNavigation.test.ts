import { globalSearchFieldConfig } from '@keres/shared/metadata/globalSearchFields';
import { navigateToEntityDetail, type NavigableEntityType } from '../../src/utils/entityNavigation';
import { useHeaderBackActionStore } from '../../src/state/headerBackActionStore';

const ENTITY_TYPES: NavigableEntityType[] = [
  'Character',
  'Scene',
  'Location',
  'Item',
  'ItemJourney',
  'Tag',
  'Choice',
  'Chapter',
  'Note',
  'WorldRule',
  'Plot',
  // Modo abre o detalhe do personagem dono - ver ENTITY_ROUTES.Mode.
  'Mode',
];

/**
 * Mode is the only navigable type with no stack and no screen of its own: the search result carries the id
 * of the owning character, and opening it leads to that character's detail. That is why it stays out of the
 * naming convention check below, but remains inside the parity check with the global search.
 */
const OWN_SCREEN_ENTITY_TYPES = ENTITY_TYPES.filter((entityType) => entityType !== 'Mode');

function fakeDrawer() {
  const navigate = jest.fn();
  return { navigate, drawer: { navigate } as any };
}

describe('navigateToEntityDetail', () => {
  beforeEach(() => useHeaderBackActionStore.setState({ crossStackReturnAction: undefined }));
  it('routes to the entity stack, its detail screen and its id param', () => {
    const { navigate, drawer } = fakeDrawer();

    navigateToEntityDetail(drawer, 'Character', 'char-1');

    expect(navigate).toHaveBeenCalledWith('CharactersStack', {
      screen: 'CharacterDetail',
      params: { characterId: 'char-1' },
    });
  });

  it.each(OWN_SCREEN_ENTITY_TYPES)('has a route for %s', (entityType) => {
    const { navigate, drawer } = fakeDrawer();

    navigateToEntityDetail(drawer, entityType, 'id-1');

    expect(navigate).toHaveBeenCalledTimes(1);
    const [stack, params] = navigate.mock.calls[0];
    const mergedStacks: Partial<Record<NavigableEntityType, string>> = {
      Scene: 'NarrativeElementsStack',
      Choice: 'NarrativeElementsStack',
      Chapter: 'NarrativeElementsStack',
      ItemJourney: 'ItemsStack',
    };
    expect(stack).toBe(
      mergedStacks[entityType] ??
        `${entityType === 'WorldRule' ? 'WorldRules' : `${entityType}s`}Stack`,
    );
    expect(params.screen).toBe(`${entityType}Detail`);
    expect(Object.values(params.params)).toEqual(['id-1']);
  });

  it('names the id param after the entity, which is what each Detail screen reads', () => {
    const { navigate, drawer } = fakeDrawer();

    navigateToEntityDetail(drawer, 'ItemJourney', 'journey-1');

    expect(navigate.mock.calls[0][1].params).toEqual({ itemJourneyId: 'journey-1' });
  });

  it('sends a mode to the detail screen of the character that owns it', () => {
    const { navigate, drawer } = fakeDrawer();

    navigateToEntityDetail(drawer, 'Mode', 'character-1');

    expect(navigate).toHaveBeenCalledWith('CharactersStack', {
      screen: 'CharacterDetail',
      params: { characterId: 'character-1' },
    });
  });

  it('passes the id through untouched', () => {
    const { navigate, drawer } = fakeDrawer();

    navigateToEntityDetail(drawer, 'Note', '01ARZ3NDEKTSV4RRFFQ69G5FAV');

    expect(navigate.mock.calls[0][1].params.noteId).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAV');
  });

  it('records an optional one-shot return for cross-stack callers', () => {
    const { drawer } = fakeDrawer();
    const returnToOrigin = jest.fn();

    navigateToEntityDetail(drawer, 'Character', 'char-1', { onReturn: returnToOrigin });

    expect(useHeaderBackActionStore.getState().consumeCrossStackReturnAction()).toBe(
      returnToOrigin,
    );
  });

  it('automatically returns to the focused source when the destination is a sibling stack', () => {
    const navigate = jest.fn();
    const drawer = {
      navigate,
      getState: () => ({
        index: 0,
        routes: [
          {
            name: 'NarrativeElementsStack',
            state: {
              index: 1,
              routes: [
                { name: 'NarrativeElements' },
                { name: 'SceneDetail', params: { sceneId: 'scene-1' } },
              ],
            },
          },
        ],
      }),
    } as any;

    navigateToEntityDetail(drawer, 'Location', 'location-1');
    useHeaderBackActionStore.getState().consumeCrossStackReturnAction()?.();

    expect(navigate).toHaveBeenNthCalledWith(2, 'NarrativeElementsStack', {
      screen: 'SceneDetail',
      params: { sceneId: 'scene-1' },
    });
  });
});

/**
 * `packages/shared/metadata/globalSearchFields.ts` documents that its list of types mirrors
 * `NavigableEntityType` by hand, because shared cannot import from the client. This test is what
 * turns that comment into a check: a global search result with no route here would be
 * an item that navigates nowhere.
 */
describe('parity with the global search entity types', () => {
  it('can navigate to every entity type the global search can return', () => {
    const searchable = Object.keys(globalSearchFieldConfig).sort();

    expect([...ENTITY_TYPES].sort()).toEqual(searchable);
  });

  it.each(Object.keys(globalSearchFieldConfig))(
    'navigates a %s search result somewhere',
    (entityType) => {
      const { navigate, drawer } = fakeDrawer();

      navigateToEntityDetail(drawer, entityType as NavigableEntityType, 'id-1');

      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate.mock.calls[0][0]).toBeTruthy();
    },
  );
});
