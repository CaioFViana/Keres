const mockToggleDrawer = jest.fn(() => ({ type: 'TOGGLE_DRAWER' }));
const mockNavigation = { dispatch: jest.fn(), navigate: jest.fn() };

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  DrawerActions: { toggleDrawer: mockToggleDrawer },
  useNavigation: jest.fn(() => mockNavigation),
}));
jest.mock('@expo/vector-icons', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    Ionicons: ({ name, color, size }: any) => (
      <View testID="drawer-icon" accessibilityLabel={`${name}:${color}:${size}`} />
    ),
  };
});
jest.mock('../../src/components/common/display/MapIcon/MapIcon', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ name, color, size }: any) => (
      <View testID="drawer-stored-icon" accessibilityLabel={`${name}:${color}:${size}`} />
    ),
  };
});
jest.mock('../../src/components/common/navigation/DrawerMenuButton/DrawerMenuButton', () => {
  const { Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onPress }: { onPress: () => void }) => (
      <Pressable testID="drawer-toggle" onPress={onPress} />
    ),
  };
});

import { fireEvent, render } from '@testing-library/react-native';
import { DrawerActions } from '@react-navigation/native';
import {
  ArcContextDrawerScreen,
  drawerIcon,
  drawerStoredIcon,
  DrawerToggleButton,
  mainSystemStackRootScreens,
} from '../../src/navigation/MainSystemDrawerHelpers';

describe('MainSystemDrawerHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (DrawerActions as any).toggleDrawer = mockToggleDrawer;
  });

  it('identifies every drawer destination that is a root screen', () => {
    expect(mainSystemStackRootScreens.has('Characters')).toBe(true);
    expect(mainSystemStackRootScreens.has('NarrativeElements')).toBe(true);
    expect(mainSystemStackRootScreens.has('HelpIndex')).toBe(true);
    expect(mainSystemStackRootScreens.has('DeviceIndex')).toBe(true);
    expect(mainSystemStackRootScreens.has('CharacterDetail')).toBe(false);
  });

  it('renders the requested drawer icon with navigation-provided colors', async () => {
    const Icon = drawerIcon('people-outline');
    const view = await render(<Icon color="#123456" size={24} />);

    expect(view.getByTestId('drawer-icon')).toHaveProp(
      'accessibilityLabel',
      'people-outline:#123456:24',
    );
  });

  it('renders a stored icon name, falling back when none is set', async () => {
    const Icon = drawerStoredIcon('keres:castle', 'library-outline');
    const picked = await render(<Icon color="#123456" size={24} />);
    expect(picked.getByTestId('drawer-stored-icon')).toHaveProp(
      'accessibilityLabel',
      'keres:castle:#123456:24',
    );

    const Fallback = drawerStoredIcon(null, 'library-outline');
    const fallback = await render(<Fallback color="#123456" size={24} />);
    expect(fallback.getByTestId('drawer-stored-icon')).toHaveProp(
      'accessibilityLabel',
      'library-outline:#123456:24',
    );
  });

  it('dispatches the drawer toggle action from the menu button', async () => {
    const view = await render(<DrawerToggleButton navigation={mockNavigation as any} />);

    fireEvent.press(view.getByTestId('drawer-toggle'));

    expect(mockToggleDrawer).toHaveBeenCalledTimes(1);
    expect(mockNavigation.dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_DRAWER' });
  });

  it('returns from an arc context route to the main dashboard', async () => {
    await render(<ArcContextDrawerScreen />);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('MainDashboard');
  });
});
