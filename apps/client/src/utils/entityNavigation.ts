import type { DrawerNavigationProp } from '@react-navigation/drawer';
// `import type` here is load-bearing, not stylistic: MainSystemStack.tsx imports every
// screen (including ones that call this helper), so a value-level import back would be a
// real require cycle (see db/index.ts's history for what that broke). A type-only import
// erases at compile time and never touches the runtime require graph.
import type { MainSystemDrawerParamList } from '../navigation/MainSystemStack';
import { useHeaderBackActionStore } from '../state/headerBackActionStore';

export type NavigableEntityType =
  | 'Character'
  | 'Scene'
  | 'Location'
  | 'Item'
  | 'ItemJourney'
  | 'Tag'
  | 'Choice'
  | 'Chapter'
  | 'Note'
  | 'WorldRule'
  | 'Mode';

interface EntityRoute {
  stack: keyof MainSystemDrawerParamList;
  screen: string;
  paramKey: string;
}

const ENTITY_ROUTES: Record<NavigableEntityType, EntityRoute> = {
  Character: { stack: 'CharactersStack', screen: 'CharacterDetail', paramKey: 'characterId' },
  Scene: { stack: 'NarrativeElementsStack', screen: 'SceneDetail', paramKey: 'sceneId' },
  Location: { stack: 'LocationsStack', screen: 'LocationDetail', paramKey: 'locationId' },
  Item: { stack: 'ItemsStack', screen: 'ItemDetail', paramKey: 'itemId' },
  ItemJourney: {
    stack: 'ItemsStack',
    screen: 'ItemJourneyDetail',
    paramKey: 'itemJourneyId',
  },
  Tag: { stack: 'TagsStack', screen: 'TagDetail', paramKey: 'tagId' },
  Choice: { stack: 'NarrativeElementsStack', screen: 'ChoiceDetail', paramKey: 'choiceId' },
  Chapter: { stack: 'NarrativeElementsStack', screen: 'ChapterDetail', paramKey: 'chapterId' },
  Note: { stack: 'NotesStack', screen: 'NoteDetail', paramKey: 'noteId' },
  WorldRule: { stack: 'WorldRulesStack', screen: 'WorldRuleDetail', paramKey: 'worldRuleId' },
  // Modo não tem tela própria: a busca global devolve o id do personagem dono no lugar do id
  // do modo, e abrir um resultado leva ao detalhe dele, onde os modos são listados.
  Mode: { stack: 'CharactersStack', screen: 'CharacterDetail', paramKey: 'characterId' },
};

/**
 * Resolves a loosely-cased entity type (the lowercase keys used by TagRelation/NoteRelation,
 * or an already-correct `NavigableEntityType`) into one this module can navigate to, or `null`
 * when it has no Detail screen - relation/junction rows (`characterscene`, `tagrelation`, ...),
 * `story`, `user`, `suggestion` and `operationlog` all legitimately land here.
 */
export function toNavigableEntityType(value: string): NavigableEntityType | null {
  const normalized = value.toLowerCase();
  const match = (Object.keys(ENTITY_ROUTES) as NavigableEntityType[]).find(
    (entityType) => entityType.toLowerCase() === normalized,
  );
  return match ?? null;
}

/**
 * Jumps from anywhere inside the main Drawer's nested stacks to another entity's Detail
 * screen, even across stacks (e.g. from a Location's screen to a Character's).
 *
 * Every entity stack lives as a sibling `Drawer.Screen` under the same Drawer navigator (see
 * `MainSystemStack.tsx`), so the Drawer is reachable from any of them via `getParent()` - the
 * same trick every Detail screen already uses to set its own header
 * (`navigation.getParent()?.setOptions(...)`). Centralized here, with the one `as any` this
 * dynamic routing needs contained to a single line, so every *caller* stays fully typed and
 * the entity -> stack/screen/param mapping has one source of truth instead of being
 * hand-written at each of the (many) places that link to a related entity.
 */
export function navigateToEntityDetail(
  drawerNavigation: DrawerNavigationProp<MainSystemDrawerParamList>,
  entityType: NavigableEntityType,
  entityId: string,
  options?: { onReturn?: () => void },
): void {
  if (options?.onReturn) {
    useHeaderBackActionStore.getState().setCrossStackReturnAction(options.onReturn);
  }
  const route = ENTITY_ROUTES[entityType];
  (drawerNavigation.navigate as (name: string, params: unknown) => void)(route.stack, {
    screen: route.screen,
    params: { [route.paramKey]: entityId },
  });
}
