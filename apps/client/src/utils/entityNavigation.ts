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
  | 'Mode'
  | 'Plot'
  | 'Route';

interface EntityRoute {
  stack: keyof MainSystemDrawerParamList;
  screen: string;
  paramKey: string;
}

interface NavigationStateLike {
  index: number;
  routes: { name: string; params?: object; state?: NavigationStateLike }[];
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
  // Mode has no screen of its own: the global search returns the owning character's id in place of the
  // mode's id, and opening a result leads to that character's detail, where the modes are listed.
  Mode: { stack: 'CharactersStack', screen: 'CharacterDetail', paramKey: 'characterId' },
  Plot: { stack: 'PlotsStack', screen: 'PlotDetail', paramKey: 'plotId' },
  Route: { stack: 'PlotsStack', screen: 'RouteDetail', paramKey: 'routeId' },
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
  const route = ENTITY_ROUTES[entityType];
  const state = drawerNavigation.getState?.() as NavigationStateLike | undefined;
  const origin = state?.routes[state.index];
  const originScreen = origin?.state?.routes[origin.state.index];

  /*
   * A Detail reached through an entity link may live in a sibling Drawer stack. That stack has no
   * native history entry for the originating screen, so `goBack()` would silently reveal whatever
   * it was last showing. Preserve the focused source by default; callers only need `onReturn` for
   * deliberate alternatives such as returning to a filtered matrix or reader.
   */
  const returnAction =
    options?.onReturn ??
    (origin && origin.name !== route.stack
      ? () => {
          (drawerNavigation.navigate as (name: string, params?: unknown) => void)(origin.name, {
            ...(originScreen
              ? { screen: originScreen.name, params: originScreen.params }
              : undefined),
          });
        }
      : undefined);
  if (returnAction) useHeaderBackActionStore.getState().setCrossStackReturnAction(returnAction);

  (drawerNavigation.navigate as (name: string, params: unknown) => void)(route.stack, {
    screen: route.screen,
    params: { [route.paramKey]: entityId },
  });
}
