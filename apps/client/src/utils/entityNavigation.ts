import type { DrawerNavigationProp } from '@react-navigation/drawer';
// `import type` here is load-bearing, not stylistic: MainSystemStack.tsx imports every
// screen (including ones that call this helper), so a value-level import back would be a
// real require cycle (see db/index.ts's history for what that broke). A type-only import
// erases at compile time and never touches the runtime require graph.
import type { MainSystemDrawerParamList } from '../navigation/MainSystemStack';

export type NavigableEntityType = 'Character' | 'Scene' | 'Location' | 'Item';

interface EntityRoute {
  stack: keyof MainSystemDrawerParamList;
  screen: string;
  paramKey: string;
}

const ENTITY_ROUTES: Record<NavigableEntityType, EntityRoute> = {
  Character: { stack: 'CharactersStack', screen: 'CharacterDetail', paramKey: 'characterId' },
  Scene: { stack: 'ScenesStack', screen: 'SceneDetail', paramKey: 'sceneId' },
  Location: { stack: 'LocationsStack', screen: 'LocationDetail', paramKey: 'locationId' },
  Item: { stack: 'ItemsStack', screen: 'ItemDetail', paramKey: 'itemId' },
};

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
  entityId: string
): void {
  const route = ENTITY_ROUTES[entityType];
  (drawerNavigation.navigate as (name: string, params: unknown) => void)(
    route.stack,
    { screen: route.screen, params: { [route.paramKey]: entityId } }
  );
}
