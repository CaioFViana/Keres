import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

/**
 * The installer overlay's own rules: it stays hidden until the story form asks, hosts the
 * shipped catalogue with its close control, and closing returns to the untouched form.
 *
 * `ShippedPacksContent` is a double here: what this asserts is which props the overlay hands it
 * (the close wiring), not the catalogue itself - that stays pinned in
 * `test/screens/packs/ShippedPacksScreen.test.tsx`.
 */

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { background: '#fff' } }),
}));

// The real surface renders a native `Modal`, which RNTL cannot see into on this platform.
jest.mock('../../src/components/layout/ThemedFullscreenModal/ThemedFullscreenModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? <View>{children}</View> : null,
  };
});

jest.mock('../../src/screens/packs/ShippedPacksContent', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const native = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: (props: { onClose?: () => void; showCloseButton?: boolean }) =>
      react.createElement(
        native.View,
        { testID: 'shipped-content' },
        react.createElement(
          native.Text,
          { testID: 'shipped-content-close-visible' },
          String(props.showCloseButton ?? false),
        ),
        react.createElement(
          native.Text,
          { testID: 'shipped-content-close', onPress: props.onClose },
          'close',
        ),
      ),
  };
});

import ShippedPacksInstallerOverlay from '../../src/components/features/packs/ShippedPacksInstallerOverlay';
import { useShippedPacksInstallerStore } from '../../src/state/shippedPacksInstallerStore';

beforeEach(() => {
  useShippedPacksInstallerStore.setState({ open: false, lastInstalledPackId: null });
});

afterEach(() => {
  cleanup();
});

it('stays hidden until opened', async () => {
  const view = await render(<ShippedPacksInstallerOverlay />);

  expect(view.queryByTestId('shipped-content')).toBeNull();

  await act(async () => {
    useShippedPacksInstallerStore.getState().openInstaller();
  });

  await waitFor(() => expect(view.getByTestId('shipped-content')).toBeTruthy());
  expect(view.getByTestId('shipped-content-close-visible').props.children).toBe('true');
});

it('closes back to the form', async () => {
  useShippedPacksInstallerStore.setState({ open: true, lastInstalledPackId: null });
  const view = await render(<ShippedPacksInstallerOverlay />);

  await waitFor(() => expect(view.getByTestId('shipped-content')).toBeTruthy());
  await fireEvent.press(view.getByTestId('shipped-content-close'));

  await waitFor(() => expect(view.queryByTestId('shipped-content')).toBeNull());
  expect(useShippedPacksInstallerStore.getState().open).toBe(false);
});
