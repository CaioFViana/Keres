import { DrawerActions } from '@react-navigation/native';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { PanResponder, StyleSheet, Text } from 'react-native';
import DrawerMenuButton from '../../../src/components/common/navigation/DrawerMenuButton/DrawerMenuButton';
import NavigationBackButton from '../../../src/components/common/navigation/NavigationBackButton/NavigationBackButton';
import NavigationDrawerButton from '../../../src/components/common/navigation/NavigationDrawerButton/NavigationDrawerButton';
import ResizableDrawerContent, {
  DRAWER_DEFAULT_WIDTH,
  DRAWER_MAX_WIDTH,
  DRAWER_MIN_WIDTH,
  useResizableDrawerWidth,
} from '../../../src/components/common/navigation/ResizableDrawerContent/ResizableDrawerContent';
import { navigationButtonStyles } from '../../../src/components/common/navigation/navigationButtonStyles';

jest.mock('../../../src/theme', () => {
  const actual = jest.requireActual('../../../src/theme');
  return {
    ...actual,
    useTheme: () => ({
      isDarkMode: false,
      colors: {
        primary: '#0000ff',
        primaryContainer: '#ddddff',
        onPrimary: '#ffffff',
        onPrimaryContainer: '#000088',
        secondary: '#00aaaa',
        onSecondary: '#ffffff',
        background: '#ffffff',
        surface: '#f5f5f5',
        card: '#eeeeee',
        onSurface: '#111111',
        text: '#111111',
        textSecondary: '#555555',
        border: '#dddddd',
        error: '#ff0000',
        onError: '#ffffff',
        accent: '#00ff00',
        onAccent: '#001100',
        notification: '#ffaa00',
        onNotification: '#221100',
        shadow: '#000000',
      },
    }),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Icon',
  MaterialCommunityIcons: 'MIcon',
}));

const mockCapturedScrollProps: any[] = [];

jest.mock('@react-navigation/drawer', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const native = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    DrawerContentScrollView: (props: any) => {
      mockCapturedScrollProps.push(props);
      return react.createElement(native.View, { testID: 'drawer-scroll' }, props.children);
    },
    DrawerItemList: () => react.createElement(native.Text, { testID: 'drawer-items' }, 'items'),
  };
});

describe('navigation buttons', () => {
  it('goes back on press', async () => {
    const onPress = jest.fn();
    const screen = await render(<NavigationBackButton onPress={onPress} />);

    await fireEvent.press(screen.getByLabelText('go_back'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.container.queryAll((node) => node.type === 'Icon')[0].props.name).toBe(
      'arrow-back',
    );
  });

  it('toggles the drawer', async () => {
    const dispatch = jest.fn();
    const screen = await render(<NavigationDrawerButton navigation={{ dispatch }} />);

    await fireEvent.press(screen.getByLabelText('Menu'));
    expect(dispatch).toHaveBeenCalledWith(DrawerActions.toggleDrawer());
  });

  it('opens the menu from nested screens', async () => {
    const onPress = jest.fn();
    const screen = await render(<DrawerMenuButton onPress={onPress} />);

    expect(screen.getByTestId('drawer-menu-button')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('open_navigation_menu'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shares one hit-area style', () => {
    expect(StyleSheet.flatten(navigationButtonStyles.button)).toMatchObject({
      minWidth: 36,
      minHeight: 36,
      marginLeft: 12,
      alignItems: 'center',
      justifyContent: 'center',
    });
  });
});

describe('useResizableDrawerWidth', () => {
  const WidthProbe = ({ viewportWidth }: { viewportWidth: number }) => {
    const { drawerWidth, maximumWidth } = useResizableDrawerWidth(viewportWidth);
    return <Text testID="widths">{`${drawerWidth}/${maximumWidth}`}</Text>;
  };

  it('caps the drawer at half the viewport within hard limits', async () => {
    expect(DRAWER_MIN_WIDTH).toBe(280);
    expect(DRAWER_DEFAULT_WIDTH).toBe(280);
    expect(DRAWER_MAX_WIDTH).toBe(520);

    const wide = await render(<WidthProbe viewportWidth={1000} />);
    expect(wide.getByTestId('widths').props.children).toBe('280/500');

    const narrow = await render(<WidthProbe viewportWidth={400} />);
    expect(narrow.getByTestId('widths').props.children).toBe('280/280');
  });

  it('updates and clamps the width', async () => {
    const Probe = ({ viewportWidth }: { viewportWidth: number }) => {
      const { drawerWidth, setDrawerWidth } = useResizableDrawerWidth(viewportWidth);
      return (
        <Text testID="w" onPress={() => setDrawerWidth(450)}>
          {String(drawerWidth)}
        </Text>
      );
    };
    const screen = await render(<Probe viewportWidth={1000} />);
    await fireEvent.press(screen.getByTestId('w'));
    expect(screen.getByTestId('w').props.children).toBe('450');

    await screen.rerender(<Probe viewportWidth={400} />);
    expect(screen.getByTestId('w').props.children).toBe('280');
  });
});

describe('ResizableDrawerContent', () => {
  const drawerProps = { navigation: {}, state: {}, descriptors: {} } as any;

  beforeEach(() => {
    mockCapturedScrollProps.length = 0;
  });

  it('renders the menu without a handle when fixed', async () => {
    const screen = await render(
      <ResizableDrawerContent
        drawerWidth={280}
        maximumWidth={500}
        onDrawerWidthChange={() => {}}
        resizable={false}
        {...drawerProps}
      />,
    );

    expect(screen.getByTestId('drawer-scroll')).toBeTruthy();
    expect(screen.getByTestId('drawer-items')).toBeTruthy();
    // PanResponder.create exposes responder props (onStartShouldSetResponder, ...), never the
    // on*PanResponder* config names, so the handle is found through the responder prop.
    expect(
      screen.container.queryAll(
        (node) => typeof node.props.onStartShouldSetResponder === 'function',
      ),
    ).toHaveLength(0);
    expect(StyleSheet.flatten(mockCapturedScrollProps[0].style).marginRight).toBe(0);
    expect(StyleSheet.flatten(mockCapturedScrollProps[0].contentContainerStyle)).toMatchObject({
      paddingTop: 12,
      paddingBottom: 12,
    });
  });

  it('reserves room for the handle scrollbar when resizable', async () => {
    await render(
      <ResizableDrawerContent
        drawerWidth={280}
        maximumWidth={500}
        onDrawerWidthChange={() => {}}
        resizable
        {...drawerProps}
      />,
    );
    expect(StyleSheet.flatten(mockCapturedScrollProps[0].style).marginRight).toBe(10);
  });

  it('drags the edge within the clamped range', async () => {
    const onDrawerWidthChange = jest.fn();
    // The component's drag logic lives in the PanResponder config; the responder props on the
    // handle feed it through internal gesture state, so the config is captured (unmocked) to
    // drive moves with explicit gesture deltas.
    const createSpy = jest.spyOn(PanResponder, 'create');
    try {
      const screen = await render(
        <ResizableDrawerContent
          drawerWidth={280}
          maximumWidth={500}
          onDrawerWidthChange={onDrawerWidthChange}
          resizable
          {...drawerProps}
        />,
      );

      const handle = screen.container.queryAll(
        (node) => typeof node.props.onStartShouldSetResponder === 'function',
      )[0];
      expect(handle.props.onStartShouldSetResponder()).toBe(true);
      expect(handle.props.onResponderTerminationRequest()).toBe(false);

      const config = createSpy.mock.calls[createSpy.mock.calls.length - 1][0];
      expect(config.onMoveShouldSetPanResponder?.(null as never, { dx: 5, dy: 1 } as never)).toBe(
        true,
      );
      expect(config.onMoveShouldSetPanResponder?.(null as never, { dx: 1, dy: 5 } as never)).toBe(
        false,
      );

      config.onPanResponderGrant?.(null as never, {} as never);
      config.onPanResponderMove?.(null as never, { dx: 60, dy: 0 } as never);
      expect(onDrawerWidthChange).toHaveBeenLastCalledWith(340);
      config.onPanResponderMove?.(null as never, { dx: 1000, dy: 0 } as never);
      expect(onDrawerWidthChange).toHaveBeenLastCalledWith(500);
      config.onPanResponderMove?.(null as never, { dx: -1000, dy: 0 } as never);
      expect(onDrawerWidthChange).toHaveBeenLastCalledWith(280);
    } finally {
      createSpy.mockRestore();
    }
  });

  it('restarts the drag from the latest width', async () => {
    const onDrawerWidthChange = jest.fn();
    const createSpy = jest.spyOn(PanResponder, 'create');
    try {
      const screen = await render(
        <ResizableDrawerContent
          drawerWidth={280}
          maximumWidth={500}
          onDrawerWidthChange={onDrawerWidthChange}
          resizable
          {...drawerProps}
        />,
      );

      await screen.rerender(
        <ResizableDrawerContent
          drawerWidth={300}
          maximumWidth={500}
          onDrawerWidthChange={onDrawerWidthChange}
          resizable
          {...drawerProps}
        />,
      );
      const handle = screen.container.queryAll(
        (node) => typeof node.props.onStartShouldSetResponder === 'function',
      )[0];
      expect(handle).toBeTruthy();
      const config = createSpy.mock.calls[createSpy.mock.calls.length - 1][0];
      config.onPanResponderGrant?.(null as never, {} as never);
      config.onPanResponderMove?.(null as never, { dx: 10, dy: 0 } as never);
      expect(onDrawerWidthChange).toHaveBeenLastCalledWith(310);
    } finally {
      createSpy.mockRestore();
    }
  });
});
