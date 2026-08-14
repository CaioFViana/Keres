import { globalSearchFieldConfig } from '@keres/shared/metadata/globalSearchFields';
import { navigateToEntityDetail, type NavigableEntityType } from '../../src/utils/entityNavigation';

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
];

function fakeDrawer() {
  const navigate = jest.fn();
  return { navigate, drawer: { navigate } as any };
}

describe('navigateToEntityDetail', () => {
  it('routes to the entity stack, its detail screen and its id param', () => {
    const { navigate, drawer } = fakeDrawer();

    navigateToEntityDetail(drawer, 'Character', 'char-1');

    expect(navigate).toHaveBeenCalledWith('CharactersStack', {
      screen: 'CharacterDetail',
      params: { characterId: 'char-1' },
    });
  });

  it.each(ENTITY_TYPES)('has a route for %s', (entityType) => {
    const { navigate, drawer } = fakeDrawer();

    navigateToEntityDetail(drawer, entityType, 'id-1');

    expect(navigate).toHaveBeenCalledTimes(1);
    const [stack, params] = navigate.mock.calls[0];
    expect(stack).toBe(`${entityType === 'WorldRule' ? 'WorldRules' : `${entityType}s`}Stack`);
    expect(params.screen).toBe(`${entityType}Detail`);
    expect(Object.values(params.params)).toEqual(['id-1']);
  });

  it('names the id param after the entity, which is what each Detail screen reads', () => {
    const { navigate, drawer } = fakeDrawer();

    navigateToEntityDetail(drawer, 'ItemJourney', 'journey-1');

    expect(navigate.mock.calls[0][1].params).toEqual({ itemJourneyId: 'journey-1' });
  });

  it('passes the id through untouched', () => {
    const { navigate, drawer } = fakeDrawer();

    navigateToEntityDetail(drawer, 'Note', '01ARZ3NDEKTSV4RRFFQ69G5FAV');

    expect(navigate.mock.calls[0][1].params.noteId).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAV');
  });
});

/**
 * `packages/shared/metadata/globalSearchFields.ts` documenta que a sua lista de tipos espelha
 * `NavigableEntityType` à mão, porque shared não pode importar do client. Este teste é o que
 * transforma esse comentário numa checagem: um resultado da busca global sem rota aqui seria
 * um item que não navega para lugar nenhum.
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
