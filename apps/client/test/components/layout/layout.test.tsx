import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Keyboard, StyleSheet, Text } from 'react-native';
import DetailContainer from '../../../src/components/layout/DetailContainer/DetailContainer';
import KeyboardAwareScreen, {
  KeyboardAwareContext,
} from '../../../src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import ResponsiveGrid from '../../../src/components/layout/ResponsiveGrid/ResponsiveGrid';
import ResponsiveModal from '../../../src/components/layout/ResponsiveModal/ResponsiveModal';
import ScreenContainer from '../../../src/components/layout/ScreenContainer/ScreenContainer';
import ScreenSection from '../../../src/components/layout/ScreenSection/ScreenSection';
import ScreenTitle from '../../../src/components/layout/ScreenTitle/ScreenTitle';
import ThemedFullscreenModal from '../../../src/components/layout/ThemedFullscreenModal/ThemedFullscreenModal';
import { useFormScrollBottomPadding } from '../../../src/hooks/useFormScrollBottomPadding';
import { useResponsiveLayout } from '../../../src/hooks/useResponsiveLayout';
import { useNotificationStore } from '../../../src/state/notificationStore';

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

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Icon',
}));

jest.mock('../../../src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: jest.fn(() => ({
    width: 390,
    height: 844,
    breakpoint: 'compact',
    isCompact: true,
    isMedium: false,
    isWide: false,
  })),
}));

jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: jest.fn(() => 58),
}));

const mockLayout = useResponsiveLayout as jest.Mock;
const mockBottomPadding = useFormScrollBottomPadding as jest.Mock;

const COMPACT = {
  width: 390,
  height: 844,
  breakpoint: 'compact',
  isCompact: true,
  isMedium: false,
  isWide: false,
};
const MEDIUM = {
  width: 800,
  height: 900,
  breakpoint: 'medium',
  isCompact: false,
  isMedium: true,
  isWide: false,
};
const WIDE = {
  width: 1400,
  height: 900,
  breakpoint: 'wide',
  isCompact: false,
  isMedium: false,
  isWide: true,
};

beforeEach(() => {
  mockLayout.mockReturnValue(COMPACT);
  mockBottomPadding.mockReturnValue(58);
});

describe('ScreenContainer', () => {
  it('paints the surface and merges style', async () => {
    const screen = await render(
      <ScreenContainer testID="surface" style={{ opacity: 0.5 }}>
        <Text>body</Text>
      </ScreenContainer>,
    );

    const surface = screen.getByTestId('surface');
    expect(StyleSheet.flatten(surface.props.style)).toMatchObject({
      flex: 1,
      backgroundColor: '#ffffff',
      opacity: 0.5,
    });
  });
});

describe('ScreenTitle', () => {
  it('scales by variant', async () => {
    const form = await render(<ScreenTitle>Form</ScreenTitle>);
    expect(StyleSheet.flatten(form.getByRole('header').props.style).fontSize).toBe(24);

    const detail = await render(<ScreenTitle variant="detail">Detail</ScreenTitle>);
    expect(StyleSheet.flatten(detail.getByRole('header').props.style).fontSize).toBe(28);
  });
});

describe('ScreenSection', () => {
  it('renders heading, description, actions and body', async () => {
    const screen = await render(
      <ScreenSection title="Fields" description="Fill them in" actions={<Text>edit</Text>}>
        <Text>control</Text>
      </ScreenSection>,
    );

    expect(screen.getByRole('header')).toBeTruthy();
    expect(screen.getByText('Fields')).toBeTruthy();
    expect(screen.getByText('Fill them in')).toBeTruthy();
    expect(screen.getByText('edit')).toBeTruthy();
    expect(screen.getByText('control')).toBeTruthy();
  });

  it('omits the description when absent', async () => {
    const screen = await render(
      <ScreenSection title="Fields">
        <Text>control</Text>
      </ScreenSection>,
    );
    expect(screen.getByText('Fields')).toBeTruthy();
    expect(screen.getByText('control')).toBeTruthy();
  });
});

describe('DetailContainer', () => {
  it('owns the single scroll view with title, footer and clearance', async () => {
    const screen = await render(
      <DetailContainer
        testID="detail"
        title="Item"
        description="About this item"
        footer={<Text>Back</Text>}
        width="reading"
      >
        <Text>Details</Text>
      </DetailContainer>,
    );

    expect(screen.getByRole('header').props.children).toBe('Item');
    expect(screen.getByText('About this item')).toBeTruthy();
    expect(screen.getByText('Back')).toBeTruthy();
    const footerWrap = screen.getByText('Back').parent;
    expect(StyleSheet.flatten(footerWrap?.props.style).marginTop).toBe(20);
    const scroll = screen.container.queryAll((node) => node.type === 'RCTScrollView')[0];
    expect(StyleSheet.flatten(scroll.props.style).backgroundColor).toBe('#ffffff');
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({
      maxWidth: 960,
      paddingBottom: 58,
    });
  });
});

describe('KeyboardAwareScreen', () => {
  it('keeps the larger of the measured and requested bottom clearance', async () => {
    const measured = await render(
      <KeyboardAwareScreen>
        <Text>body</Text>
      </KeyboardAwareScreen>,
    );
    const measuredScroll = measured.container.queryAll((node) => node.type === 'RCTScrollView')[0];
    expect(StyleSheet.flatten(measuredScroll.props.contentContainerStyle).paddingBottom).toBe(58);
    expect(measuredScroll.props.keyboardShouldPersistTaps).toBe('handled');

    const requested = await render(
      <KeyboardAwareScreen style={{ opacity: 0.5 }} contentContainerStyle={{ paddingBottom: 100 }}>
        <Text>body</Text>
      </KeyboardAwareScreen>,
    );
    const requestedScroll = requested.container.queryAll(
      (node) => node.type === 'RCTScrollView',
    )[0];
    expect(StyleSheet.flatten(requestedScroll.props.style).opacity).toBe(0.5);
    expect(StyleSheet.flatten(requestedScroll.props.contentContainerStyle).paddingBottom).toBe(100);
  });

  it('listens for the keyboard and offers focus scrolling', async () => {
    const addListener = jest.spyOn(Keyboard, 'addListener');
    const Probe = () => {
      const scroll = React.useContext(KeyboardAwareContext);
      return (
        <Text testID="ctx" onPress={() => scroll?.()}>
          {scroll ? 'yes' : 'no'}
        </Text>
      );
    };
    const screen = await render(
      <KeyboardAwareScreen>
        <Probe />
      </KeyboardAwareScreen>,
    );

    expect(screen.getByTestId('ctx').props.children).toBe('yes');
    await fireEvent.press(screen.getByTestId('ctx'));
    const events = addListener.mock.calls.map((call) => call[0]);
    expect(events).toContain('keyboardDidHide');
    expect(events.some((name) => name === 'keyboardWillShow' || name === 'keyboardDidShow')).toBe(
      true,
    );
    addListener.mockRestore();
    await screen.unmount();
  });
});

describe('ResponsiveGrid', () => {
  const widthsOf = (screen: Awaited<ReturnType<typeof render>>) =>
    screen.container
      .queryAll((node) => StyleSheet.flatten(node.props.style)?.width !== undefined)
      .map((node) => StyleSheet.flatten(node.props.style).width);

  it('reflows columns per breakpoint', async () => {
    // Siblings, not a fragment: React.Children.map counts a fragment as one child, so a
    // fragment would render a single grid cell instead of one per tile.
    const children = [<Text key="a">a</Text>, <Text key="b">b</Text>];
    mockLayout.mockReturnValue(COMPACT);
    const compact = await render(<ResponsiveGrid>{children}</ResponsiveGrid>);
    expect(widthsOf(compact)).toEqual(['50%', '50%']);

    mockLayout.mockReturnValue(MEDIUM);
    const medium = await render(<ResponsiveGrid>{children}</ResponsiveGrid>);
    expect(widthsOf(medium)).toEqual([`${100 / 3}%`, `${100 / 3}%`]);

    mockLayout.mockReturnValue(WIDE);
    const wide = await render(<ResponsiveGrid>{children}</ResponsiveGrid>);
    expect(widthsOf(wide)).toEqual(['20%', '20%']);
  });

  it('honors custom columns, gaps and style', async () => {
    const screen = await render(
      <ResponsiveGrid compactColumns={1} gap={20} style={{ opacity: 0.5 }}>
        <Text>a</Text>
      </ResponsiveGrid>,
    );

    expect(widthsOf(screen)).toEqual(['100%']);
    const grid = screen.container.queryAll(
      (node) => StyleSheet.flatten(node.props.style)?.marginHorizontal === -10,
    )[0];
    expect(StyleSheet.flatten(grid.props.style).opacity).toBe(0.5);
    const wrapper = screen.container.queryAll(
      (node) => StyleSheet.flatten(node.props.style)?.width === '100%',
    )[0];
    expect(StyleSheet.flatten(wrapper.props.style).paddingHorizontal).toBe(10);
  });
});

describe('ResponsiveModal', () => {
  const overlayOf = (screen: Awaited<ReturnType<typeof render>>) =>
    screen.container.queryAll(
      (node) => StyleSheet.flatten(node.props.style)?.backgroundColor === 'rgba(0, 0, 0, 0.5)',
    )[0];
  const contentOf = (screen: Awaited<ReturnType<typeof render>>) =>
    screen.container.queryAll(
      (node) => StyleSheet.flatten(node.props.style)?.borderRadius === 12,
    )[0];

  it('stays hidden until opened', async () => {
    // React Native's Modal renders null while hidden, so there is no Modal node at all.
    const screen = await render(
      <ResponsiveModal visible={false} onClose={() => {}}>
        <Text>body</Text>
      </ResponsiveModal>,
    );
    expect(screen.container.queryAll((node) => node.type === 'Modal')).toHaveLength(0);
    expect(screen.queryByText('body')).toBeNull();

    await screen.rerender(
      <ResponsiveModal visible onClose={() => {}}>
        <Text>body</Text>
      </ResponsiveModal>,
    );
    const modal = screen.container.queryAll((node) => node.type === 'Modal')[0];
    expect(modal.props.visible).toBe(true);
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('centers narrow windows and wider ones differently', async () => {
    mockBottomPadding.mockReturnValue(24);
    mockLayout.mockReturnValue(COMPACT);
    const compact = await render(
      <ResponsiveModal visible onClose={() => {}}>
        <Text>body</Text>
      </ResponsiveModal>,
    );
    expect(StyleSheet.flatten(contentOf(compact).props.style)).toMatchObject({
      width: '94%',
      maxWidth: 720,
      backgroundColor: '#ffffff',
    });
    expect(StyleSheet.flatten(overlayOf(compact).props.style)).toMatchObject({
      justifyContent: 'center',
      paddingBottom: 24,
    });

    mockLayout.mockReturnValue(MEDIUM);
    const medium = await render(
      <ResponsiveModal visible onClose={() => {}}>
        <Text>body</Text>
      </ResponsiveModal>,
    );
    expect(StyleSheet.flatten(contentOf(medium).props.style).width).toBe('88%');
  });

  it('docks to the bottom or the side on demand', async () => {
    mockBottomPadding.mockReturnValue(24);
    const bottom = await render(
      <ResponsiveModal visible onClose={() => {}} placement="bottom">
        <Text>body</Text>
      </ResponsiveModal>,
    );
    expect(StyleSheet.flatten(overlayOf(bottom).props.style).justifyContent).toBe('flex-end');
    expect(StyleSheet.flatten(contentOf(bottom).props.style)).toMatchObject({
      width: '100%',
      maxWidth: 1100,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    });

    const side = await render(
      <ResponsiveModal visible onClose={() => {}} placement="side">
        <Text>body</Text>
      </ResponsiveModal>,
    );
    expect(StyleSheet.flatten(overlayOf(side).props.style).alignItems).toBe('flex-start');
    expect(StyleSheet.flatten(contentOf(side).props.style)).toMatchObject({
      width: '50%',
      maxWidth: 600,
    });
  });

  it('adapts placement to the window', async () => {
    mockLayout.mockReturnValue(WIDE);
    const wide = await render(
      <ResponsiveModal visible onClose={() => {}} placement="adaptive">
        <Text>body</Text>
      </ResponsiveModal>,
    );
    expect(StyleSheet.flatten(contentOf(wide).props.style).width).toBe('50%');

    mockLayout.mockReturnValue(COMPACT);
    const compact = await render(
      <ResponsiveModal visible onClose={() => {}} placement="adaptive">
        <Text>body</Text>
      </ResponsiveModal>,
    );
    expect(StyleSheet.flatten(overlayOf(compact).props.style).justifyContent).toBe('flex-end');
  });

  it('closes on backdrop press or close request, and merges content style', async () => {
    const onClose = jest.fn();
    const screen = await render(
      <ResponsiveModal visible onClose={onClose} maxHeight={300} contentStyle={{ opacity: 0.5 }}>
        <Text>body</Text>
      </ResponsiveModal>,
    );

    expect(StyleSheet.flatten(contentOf(screen).props.style)).toMatchObject({
      maxHeight: 300,
      opacity: 0.5,
    });
    const backdrop = screen.container.queryAll(
      (node) =>
        StyleSheet.flatten(node.props.style)?.position === 'absolute' && node.children.length === 0,
    )[0];
    await fireEvent.press(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);

    const modal = screen.container.queryAll((node) => node.type === 'Modal')[0];
    modal.props.onRequestClose();
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('ThemedFullscreenModal', () => {
  it('covers the screen with the themed surface', async () => {
    const onRequestClose = jest.fn();
    const screen = await render(
      <ThemedFullscreenModal visible onRequestClose={onRequestClose}>
        <Text>full</Text>
      </ThemedFullscreenModal>,
    );

    expect(screen.getByText('full')).toBeTruthy();
    const modal = screen.container.queryAll((node) => node.type === 'Modal')[0];
    expect(modal.props.visible).toBe(true);
    expect(modal.props.animationType).toBe('slide');
    modal.props.onRequestClose();
    expect(onRequestClose).toHaveBeenCalledTimes(1);
    const surface = screen.getByText('full').parent;
    expect(StyleSheet.flatten(surface?.props.style).backgroundColor).toBe('#ffffff');
  });

  it('draws toasts fired from inside as ordinary children', async () => {
    useNotificationStore.setState({
      currentNotifications: [{ id: 'a', message: 'Pack installed', type: 'success' }, null, null],
      queue: [],
    });
    try {
      const screen = await render(
        <ThemedFullscreenModal visible onRequestClose={() => {}}>
          <Text>full</Text>
        </ThemedFullscreenModal>,
      );

      // The overlay content stays, and the toast lands with it - no second Modal, which iOS
      // would refuse to present over this one.
      expect(screen.getByText('full')).toBeTruthy();
      expect(screen.getByText('Pack installed')).toBeTruthy();
    } finally {
      await act(async () => {
        useNotificationStore.setState({ currentNotifications: [null, null, null], queue: [] });
      });
    }
  });
});
