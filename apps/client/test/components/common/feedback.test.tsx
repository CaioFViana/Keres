import { act, fireEvent, render } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import AppAlertHost from '../../../src/components/common/feedback/AppAlertHost/AppAlertHost';
import NotificationItem from '../../../src/components/common/feedback/NotificationItem/NotificationItem';
import NotificationPopup from '../../../src/components/common/feedback/NotificationPopup/NotificationPopup';
import {
  ScreenError,
  ScreenLoading,
} from '../../../src/components/common/feedback/ScreenState/ScreenState';
import { useAppAlertStore } from '../../../src/state/appAlertStore';
import { useGalleryMediaViewerStore } from '../../../src/state/galleryMediaViewerStore';
import { useNotificationStore } from '../../../src/state/notificationStore';
import { usePresenceMatrixViewerStore } from '../../../src/state/presenceMatrixViewerStore';
import { useShippedPacksInstallerStore } from '../../../src/state/shippedPacksInstallerStore';

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

describe('ScreenLoading', () => {
  it('shows the default loading message', async () => {
    const screen = await render(<ScreenLoading />);
    expect(screen.getByText('loading...')).toBeTruthy();
  });

  it('shows a custom message with detail padding', async () => {
    const screen = await render(<ScreenLoading message="Fetching story" padded />);
    const container = screen.getByText('Fetching story').parent;
    expect(StyleSheet.flatten(container?.props.style).padding).toBe(20);
  });
});

describe('ScreenError', () => {
  it('shows the message in the error color with a back action', async () => {
    const onGoBack = jest.fn();
    const screen = await render(<ScreenError message="Missing story" onGoBack={onGoBack} />);

    const message = screen.getByText('Missing story');
    expect(StyleSheet.flatten(message.props.style).color).toBe('#ff0000');
    await fireEvent.press(screen.getByText('go_back'));
    expect(onGoBack).toHaveBeenCalledTimes(1);
  });

  it('renders no action when onGoBack is omitted', async () => {
    const screen = await render(<ScreenError message="Missing story" padded />);
    expect(screen.queryByText('go_back')).toBeNull();
  });
});

describe('AppAlertHost', () => {
  afterEach(() => {
    useAppAlertStore.setState({ current: null });
  });

  it('renders nothing when no alert is queued', async () => {
    useAppAlertStore.setState({ current: null });
    const screen = await render(<AppAlertHost />);
    expect(screen.toJSON()).toBeNull();
  });

  it('runs a default button before dismissing', async () => {
    const onPress = jest.fn();
    useAppAlertStore.setState({
      current: {
        title: 'Delete?',
        message: 'This cannot be undone.',
        buttons: [{ text: 'Delete', onPress }],
        cancelable: true,
      },
    });
    const screen = await render(<AppAlertHost />);

    expect(screen.getByText('Delete?')).toBeTruthy();
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Delete'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(useAppAlertStore.getState().current).toBeNull();
  });

  it('renders cancel and destructive variants and an OK fallback without message', async () => {
    const onCancel = jest.fn();
    const onDelete = jest.fn();
    useAppAlertStore.setState({
      current: {
        title: 'Confirm',
        buttons: [
          { text: 'Keep', style: 'cancel', onPress: onCancel },
          { text: 'Drop', style: 'destructive', onPress: onDelete },
          {},
        ],
        cancelable: true,
      },
    });
    const screen = await render(<AppAlertHost />);

    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('OK')).toBeTruthy();
    await fireEvent.press(screen.getByText('Drop'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('dismisses on backdrop press when cancelable', async () => {
    useAppAlertStore.setState({
      current: { title: 'Hello', buttons: [{ text: 'OK' }], cancelable: true },
    });
    const screen = await render(<AppAlertHost />);

    const backdrop = screen.container.queryAll(
      (node) => StyleSheet.flatten(node.props.style)?.backgroundColor === 'rgba(0, 0, 0, 0.6)',
    )[0];
    await fireEvent.press(backdrop);
    expect(useAppAlertStore.getState().current).toBeNull();
  });

  it('keeps a non-cancelable alert open on backdrop press or close request', async () => {
    useAppAlertStore.setState({
      current: { title: 'Hello', buttons: [{ text: 'OK' }], cancelable: false },
    });
    const screen = await render(<AppAlertHost />);

    const backdrop = screen.container.queryAll(
      (node) => StyleSheet.flatten(node.props.style)?.backgroundColor === 'rgba(0, 0, 0, 0.6)',
    )[0];
    await fireEvent.press(backdrop);
    expect(useAppAlertStore.getState().current).not.toBeNull();
    const modal = screen.container.queryAll((node) => node.type === 'Modal')[0];
    modal.props.onRequestClose();
    expect(useAppAlertStore.getState().current).not.toBeNull();
  });

  it('ignores presses inside the card', async () => {
    useAppAlertStore.setState({
      current: { title: 'Hello', buttons: [{ text: 'OK' }], cancelable: true },
    });
    const screen = await render(<AppAlertHost />);

    await fireEvent.press(screen.getByText('Hello'));
    expect(useAppAlertStore.getState().current).not.toBeNull();
  });
});

describe('NotificationPopup', () => {
  // Awaited: a sync `act` leaves its scope open and empties every later render in the file.
  afterEach(async () => {
    // This file's resets run before RNTL's auto-cleanup, so the trees are still mounted.
    await act(async () => {
      useNotificationStore.setState({ currentNotifications: [null, null, null], queue: [] });
      useGalleryMediaViewerStore.setState({ galleryId: null });
      usePresenceMatrixViewerStore.setState({ request: null });
      useShippedPacksInstallerStore.setState({ open: false, lastInstalledPackId: null });
    });
  });

  it('renders nothing when every lane is empty', async () => {
    useNotificationStore.setState({ currentNotifications: [null, null, null], queue: [] });
    const screen = await render(<NotificationPopup />);
    expect(screen.container.queryAll((node) => node.type === 'Icon')).toHaveLength(0);
  });

  it('shows each queued notification with its lane offset', async () => {
    useNotificationStore.setState({
      currentNotifications: [
        { id: 'a', message: 'Saved', type: 'success' },
        { id: 'b', message: 'Failed', type: 'error' },
        null,
      ],
      queue: [],
    });
    const screen = await render(<NotificationPopup />);

    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
    const icons = screen.container.queryAll((node) => node.type === 'Icon');
    expect(icons.map((icon) => icon.props.name)).toContain('alert-circle-outline');
  });

  it('clears a lane through its close button', async () => {
    useNotificationStore.setState({
      currentNotifications: [{ id: 'a', message: 'Saved', type: 'success' }, null, null],
      queue: [],
    });
    const screen = await render(<NotificationPopup />);

    const close = screen.container.queryAll(
      (node) => node.type === 'Icon' && node.props.name === 'close-circle-outline',
    )[0];
    await fireEvent.press(close);
    expect(useNotificationStore.getState().currentNotifications[0]).toBeNull();
  });

  it('hides the modal layer when every lane is empty', async () => {
    useNotificationStore.setState({ currentNotifications: [null, null, null], queue: [] });
    const screen = await render(<NotificationPopup />);

    expect(screen.queryByTestId('notification-modal')).toBeNull();
  });

  it('rides a transparent passthrough modal while a lane is occupied', async () => {
    useNotificationStore.setState({
      currentNotifications: [{ id: 'a', message: 'Saved', type: 'success' }, null, null],
      queue: [],
    });
    const screen = await render(<NotificationPopup />);

    // A fullscreen native Modal lives above the whole React tree, where no zIndex can reach -
    // the toasts need a native layer of their own to stay visible over one.
    const modal = screen.getByTestId('notification-modal');
    expect(modal.props.visible).toBe(true);
    expect(modal.props.transparent).toBe(true);
    // ...which must never eat touches meant for the app beneath.
    expect(screen.getByTestId('notification-lanes').props.pointerEvents).toBe('box-none');
  });

  it('stands down while a fullscreen overlay draws the lanes itself', async () => {
    useNotificationStore.setState({
      currentNotifications: [{ id: 'a', message: 'Saved', type: 'success' }, null, null],
      queue: [],
    });

    // The shipped-packs installer: the toast must come from inside its Modal, not from here.
    useShippedPacksInstallerStore.setState({ open: true });
    const installing = await render(<NotificationPopup />);
    expect(installing.queryByTestId('notification-modal')).toBeNull();
    expect(installing.queryByText('Saved')).toBeNull();

    // Same deal for the other two fullscreen overlays.
    await act(async () => {
      useShippedPacksInstallerStore.setState({ open: false });
      useGalleryMediaViewerStore.setState({ galleryId: 'g1' });
    });
    const peeking = await render(<NotificationPopup />);
    expect(peeking.queryByTestId('notification-modal')).toBeNull();
    expect(peeking.queryByText('Saved')).toBeNull();

    await act(async () => {
      useGalleryMediaViewerStore.setState({ galleryId: null });
      usePresenceMatrixViewerStore.setState({ request: { kind: 'character', characterId: 'c1' } });
    });
    const matrix = await render(<NotificationPopup />);
    expect(matrix.queryByTestId('notification-modal')).toBeNull();
    expect(matrix.queryByText('Saved')).toBeNull();
  });

  it('keeps the plain passthrough view on android, where a modal dialog eats every touch', async () => {
    const restorePlatform = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      useNotificationStore.setState({
        currentNotifications: [{ id: 'a', message: 'Saved', type: 'success' }, null, null],
        queue: [],
      });
      const screen = await render(<NotificationPopup />);

      // A fullscreen Android dialog consumes every touch inside its bounds - including the
      // ones `box-none` lets fall through - so the app beneath would freeze until the toast
      // fades. The plain host is an ordinary view: touches outside the items never hit it.
      expect(screen.queryByTestId('notification-modal')).toBeNull();
      expect(screen.getByText('Saved')).toBeTruthy();
      expect(screen.getByTestId('notification-host').props.pointerEvents).toBe('box-none');
    } finally {
      restorePlatform.restore();
    }
  });

  it('keeps the plain view on web, where a fixed overlay would swallow clicks', async () => {
    const restorePlatform = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      useNotificationStore.setState({
        currentNotifications: [{ id: 'a', message: 'Saved', type: 'success' }, null, null],
        queue: [],
      });
      const screen = await render(<NotificationPopup />);

      expect(screen.queryByTestId('notification-modal')).toBeNull();
      expect(screen.getByText('Saved')).toBeTruthy();
    } finally {
      restorePlatform.restore();
    }
  });
});

describe('NotificationItem', () => {
  afterEach(() => {
    useNotificationStore.setState({ currentNotifications: [null, null, null], queue: [] });
  });

  it('uses the error treatment for failures', async () => {
    const screen = await render(
      <NotificationItem
        notification={{ id: 'a', message: 'Failed', type: 'error' }}
        laneIndex={1}
      />,
    );

    const container = screen.getByText('Failed').parent?.parent;
    expect(StyleSheet.flatten(container?.props.style).backgroundColor).toBe('#ff0000');
    expect(StyleSheet.flatten(container?.props.style).top).toBe(50 + 1 * 80);
  });

  it('uses the card treatment for informational notes', async () => {
    const screen = await render(
      <NotificationItem
        notification={{ id: 'a', message: 'Heads up', type: 'info' }}
        laneIndex={0}
      />,
    );

    const container = screen.getByText('Heads up').parent?.parent;
    expect(StyleSheet.flatten(container?.props.style).backgroundColor).toBe('#eeeeee');
  });
});
