import {
  createNavigationContainerRef,
  createNavigatorFactory,
  DrawerRouter,
  NavigationContainer,
  StackRouter,
  useNavigationBuilder,
} from '@react-navigation/native';
import { act, render } from '@testing-library/react-native';
import { View } from 'react-native';
import { navigateAcrossStacks } from '@/src/utils/nav/stackNavigation';

/**
 * The real routers of React Navigation (a drawer holding a stack) without any native view: what is being
 * checked is where each action leaves the navigation state, not how it is drawn.
 */

/**
 * A drawer keeps what it has drawn: a screen left behind stays mounted, with its history, until it is
 * focused again - which is what makes a stack remember the form it last showed.
 */
function DrawerHost({ children, ...rest }: any) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(DrawerRouter, {
    children,
    ...rest,
  });
  // The drawer's own history lists every route that has been in focus: those are the ones it has drawn.
  const drawn = new Set<string>([
    state.routes[state.index]!.key,
    ...((state as any).history ?? []).map((entry: any) => entry.key),
  ]);
  return (
    <NavigationContent>
      {state.routes
        .filter((route) => drawn.has(route.key))
        .map((route) => (
          <View
            key={route.key}
            style={{ display: route.key === state.routes[state.index]!.key ? 'flex' : 'none' }}
          >
            {descriptors[route.key]!.render()}
          </View>
        ))}
    </NavigationContent>
  );
}

function StackHost({ children, ...rest }: any) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(StackRouter, {
    children,
    ...rest,
  });
  return (
    <NavigationContent>{descriptors[state.routes[state.index]!.key]!.render()}</NavigationContent>
  );
}

/** The dashboard's own `navigation`: what its shortcuts call `navigateAcross` with. */
let dashboardNavigation: any;
const Dashboard = ({ navigation }: any) => {
  dashboardNavigation = navigation;
  return null;
};
const List = () => null;
const Form = () => null;

const Drawer = createNavigatorFactory(DrawerHost)();
const Stack = createNavigatorFactory(StackHost)();

function ArcsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="StoryArcList" component={List} />
      <Stack.Screen name="StoryArcForm" component={Form} />
    </Stack.Navigator>
  );
}

const ref = createNavigationContainerRef<any>();

async function mount() {
  await render(
    <NavigationContainer ref={ref}>
      <Drawer.Navigator initialRouteName="Dashboard">
        <Drawer.Screen name="Dashboard" component={Dashboard} />
        <Drawer.Screen name="ArcsStack" component={ArcsStack} />
      </Drawer.Navigator>
    </NavigationContainer>,
  );
}

/** What the person is looking at: the drawer's route and, inside a stack, its top screen. */
const rootState = () => ref.getRootState()!;

const where = () => {
  const root = rootState();
  const route = root.routes[root.index]!;
  const nested = route.state as any;
  return nested ? `${route.name}/${nested.routes[nested.index].name}` : route.name;
};

const openFormFromDashboard = (arcId = 'a1') =>
  act(async () => {
    navigateAcrossStacks(
      dashboardNavigation,
      { stack: 'ArcsStack', screen: 'StoryArcForm', params: { arcId } },
      { fresh: true },
    );
  });

/** The arcs stack's own screens, from the top of the container down. */
const arcsStack = () =>
  (rootState().routes.find((route) => route.name === 'ArcsStack')?.state as any)?.routes.map(
    (route: any) => route.name,
  );

describe('an arc form opened from the dashboard', () => {
  it('opens on the form', async () => {
    await mount();
    expect(where()).toBe('Dashboard');

    await openFormFromDashboard();

    expect(where()).toBe('ArcsStack/StoryArcForm');
  });

  it('closes on going back, every time it is opened: the stack had not drawn, or holds what a visit left', async () => {
    await mount();

    for (const visit of ['first', 'second', 'third']) {
      await openFormFromDashboard();
      expect(`${visit}: ${where()}`).toBe(`${visit}: ArcsStack/StoryArcForm`);
      // Only the form: nothing below it for a save to land on.
      expect(arcsStack()).toEqual(['StoryArcForm']);

      await act(async () => {
        ref.goBack();
      });

      expect(`${visit}: ${where()}`).toBe(`${visit}: Dashboard`);
    }
  });

  it('starts over when the stack was left on the list and a form of another arc', async () => {
    await mount();
    // The person has been through the arcs before: the list, then the form of one of them.
    await act(async () => {
      dashboardNavigation.navigate('ArcsStack', { screen: 'StoryArcList' });
    });
    await act(async () => {
      ref.navigate('ArcsStack', { screen: 'StoryArcForm', params: { arcId: 'old' } });
    });
    expect(arcsStack()).toEqual(['StoryArcList', 'StoryArcForm']);
    await act(async () => {
      ref.navigate('Dashboard');
    });

    await openFormFromDashboard('new');

    expect(arcsStack()).toEqual(['StoryArcForm']);
    const form = (rootState().routes[1]!.state as any).routes[0];
    expect(form.params).toEqual({ arcId: 'new' });
    await act(async () => {
      ref.goBack();
    });
    expect(where()).toBe('Dashboard');
  });
});
