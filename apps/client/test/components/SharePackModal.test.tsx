import { act, render } from '@testing-library/react-native';
import React from 'react';

/**
 * The share modal's own rules.
 *
 * What it replaced was a chain of two alerts - one button per server, then a second alert asking
 * about the showcase - so the rules worth holding are the ones that chain could not express: both
 * questions visible at once, no confirming without a server, and a public answer that never
 * survives into the next share.
 *
 * `Select` is a double here: what this asserts is which values the modal hands back, not how a
 * dropdown opens.
 */

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  const value = { t };
  return { __esModule: true, useTranslation: () => value };
});

// The real surface renders a native `Modal`, which RNTL cannot see into on this platform.
jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? <View>{children}</View> : null,
  };
});

/** A dropdown reduced to what the modal reads from it: its value, and a way to change it. */
jest.mock('../../src/components/common/inputs/Select/Select', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      options,
      value,
      onValueChange,
      placeholder,
    }: {
      options: Array<{ label: string; value: string }>;
      value: string | null;
      onValueChange: (next: string | null) => void;
      placeholder?: string;
    }) => (
      <View
        testID={`select-${placeholder ?? 'visibility'}`}
        accessibilityValue={{ text: value ?? '' }}
        options={options}
        onValueChange={onValueChange}
      />
    ),
  };
});

jest.mock('../../src/components/common/controls/Button/Button', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      children,
      onPress,
      disabled,
      testID,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
      testID?: string;
    }) => (
      <Text testID={testID ?? String(children)} onPress={onPress} disabled={disabled}>
        {children}
      </Text>
    ),
  };
});

import SharePackModal from '../../src/components/features/packs/SharePackModal/SharePackModal';

const SERVER_SELECT = 'select-packs_browse_choose_server';
const VISIBILITY_SELECT = 'select-visibility';

const servers = [
  { id: 'server-1', name: 'Home', url: 'https://home.example' },
  { id: 'server-2', name: null, url: 'https://other.example' },
];

const onConfirm = jest.fn();
const onCancel = jest.fn();

beforeEach(() => jest.clearAllMocks());

// RNTL 14 settles the first render asynchronously; a bare call leaves every query on nothing.
const renderModal = async (props: Partial<React.ComponentProps<typeof SharePackModal>> = {}) =>
  render(
    <SharePackModal
      visible
      packName="Tabletop stats"
      servers={servers}
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...props}
    />,
  );

type Screen = Awaited<ReturnType<typeof renderModal>>;

const choose = async (screen: Screen, testID: string, value: string) => {
  await act(async () => {
    screen.getByTestId(testID).props.onValueChange(value);
  });
};

describe('choosing where a pack goes', () => {
  it('asks both questions in one place', async () => {
    const screen = await renderModal();

    expect(screen.getByTestId(SERVER_SELECT)).toBeTruthy();
    expect(screen.getByTestId(VISIBILITY_SELECT)).toBeTruthy();
  });

  /** A server with no name is still a server; the address is what identifies it. */
  it('falls back to the address for an unnamed server', async () => {
    const screen = await renderModal();

    expect(screen.getByTestId(SERVER_SELECT).props.options).toEqual([
      { label: 'Home', value: 'server-1' },
      { label: 'https://other.example', value: 'server-2' },
    ]);
  });

  it('refuses to confirm before a server is chosen', async () => {
    const screen = await renderModal();

    expect(screen.getByTestId('confirm-share-pack').props.disabled).toBe(true);
  });

  /** With one server there is nothing to choose, so choosing it is not asked of anybody. */
  it('preselects the only server there is', async () => {
    const screen = await renderModal({ servers: [servers[0]] });

    expect(screen.getByTestId(SERVER_SELECT).props.accessibilityValue.text).toBe('server-1');
    expect(screen.getByTestId('confirm-share-pack').props.disabled).toBe(false);
  });

  it('hands back the server and the visibility that were chosen', async () => {
    const screen = await renderModal();
    await choose(screen, SERVER_SELECT, 'server-2');
    await choose(screen, VISIBILITY_SELECT, 'public');

    await act(async () => screen.getByTestId('confirm-share-pack').props.onPress());

    expect(onConfirm).toHaveBeenCalledWith('server-2', 'public');
  });

  it('shares privately unless asked otherwise', async () => {
    const screen = await renderModal({ servers: [servers[0]] });

    await act(async () => screen.getByTestId('confirm-share-pack').props.onPress());

    expect(onConfirm).toHaveBeenCalledWith('server-1', 'private');
  });

  /**
   * Public is never inherited. Sharing one pack to the showcase says nothing about the next one,
   * and a dropdown that remembered it would put a pack on a public page by momentum.
   */
  it('forgets a public answer when it opens again', async () => {
    const screen = await renderModal({ servers: [servers[0]] });
    await choose(screen, VISIBILITY_SELECT, 'public');

    await screen.rerender(
      <SharePackModal
        visible={false}
        packName="Tabletop stats"
        servers={[servers[0]]}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    await screen.rerender(
      <SharePackModal
        visible
        packName="Novel craft"
        servers={[servers[0]]}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    await act(async () => screen.getByTestId('confirm-share-pack').props.onPress());
    expect(onConfirm).toHaveBeenCalledWith('server-1', 'private');
  });

  /**
   * The answers survive the parent re-rendering.
   *
   * `servers` is a new array on every render of whoever owns this modal, so an effect keyed on it
   * would clear the choice under somebody halfway through making it - and the reset would look, to
   * them, like the dropdown refusing to hold a value.
   */
  it('keeps the choice when the parent re-renders', async () => {
    const screen = await renderModal();
    await choose(screen, SERVER_SELECT, 'server-2');
    await choose(screen, VISIBILITY_SELECT, 'public');

    await screen.rerender(
      <SharePackModal
        visible
        packName="Tabletop stats"
        // A fresh array with the same contents, exactly as a re-rendering parent supplies.
        servers={servers.map((server) => ({ ...server }))}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    await act(async () => screen.getByTestId('confirm-share-pack').props.onPress());
    expect(onConfirm).toHaveBeenCalledWith('server-2', 'public');
  });

  it('cancels without sharing', async () => {
    const screen = await renderModal();

    await act(async () => screen.getByTestId('cancel').props.onPress());

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
