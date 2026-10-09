jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../src/theme', () => {
  const actual = jest.requireActual('../../src/theme');
  return {
    ...actual,
    useTheme: () => ({
      isDarkMode: false,
      colors: {
        primary: '#0000ff',
        onPrimary: '#ffffff',
        text: '#111111',
        textSecondary: '#555555',
        background: '#ffffff',
        surface: '#f5f5f5',
        border: '#cccccc',
        error: '#ff0000',
        onError: '#ffffff',
        accent: '#ff8800',
        onAccent: '#000000',
        secondary: '#00aa00',
        onSecondary: '#ffffff',
        shadow: '#000000',
      },
    }),
  };
});
jest.mock('@/src/components/layout/ResponsiveModal/ResponsiveModal', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? <>{children}</> : null,
}));
jest.mock('@/src/components/common/controls/FormActions/FormActions', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import InviteToStoryModal from '../../src/components/features/friendship/InviteToStoryModal';

const STORIES = [
  { id: 's1', title: 'Abelha' },
  { id: 's2', title: 'Zebra' },
];

type ModalProps = React.ComponentProps<typeof InviteToStoryModal>;

const renderModal = async (over: Partial<ModalProps> = {}) => {
  const props: ModalProps = {
    visible: true,
    onClose: jest.fn(),
    friendName: 'Zoe',
    serverName: 'Main',
    stories: STORIES,
    busy: false,
    onInvite: jest.fn(async () => true),
    ...over,
  };
  return { props, screen: await render(<InviteToStoryModal {...props} />) };
};

afterEach(() => cleanup());

describe('InviteToStoryModal', () => {
  it('offers the stories it is given, with nothing chosen and the invitation not yet possible', async () => {
    const { screen } = await renderModal();

    expect(screen.getByText('Abelha')).toBeTruthy();
    expect(screen.getByText('Zebra')).toBeTruthy();
    expect(screen.getByTestId('invite-to-story-confirm').props.accessibilityState?.disabled).toBe(
      true,
    );
  });

  it('sends the chosen story and role, and closes once the invitation went out', async () => {
    const { props, screen } = await renderModal();

    await fireEvent.press(screen.getByTestId('invite-story-s2'));
    await fireEvent.press(screen.getByTestId('invite-role-writer'));
    await fireEvent.press(screen.getByTestId('invite-to-story-confirm'));

    expect(props.onInvite).toHaveBeenCalledWith('s2', 'writer');
    await screen.findByTestId('invite-to-story-confirm');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('offers the reader role unless another is chosen', async () => {
    const { props, screen } = await renderModal();

    await fireEvent.press(screen.getByTestId('invite-story-s1'));
    await fireEvent.press(screen.getByTestId('invite-to-story-confirm'));

    expect(props.onInvite).toHaveBeenCalledWith('s1', 'reader');
  });

  it('stays open when the invitation did not go out', async () => {
    const { props, screen } = await renderModal({ onInvite: jest.fn(async () => false) });

    await fireEvent.press(screen.getByTestId('invite-story-s1'));
    await fireEvent.press(screen.getByTestId('invite-to-story-confirm'));

    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('does not send while an invitation is already on its way', async () => {
    const { props, screen } = await renderModal({ busy: true });

    await fireEvent.press(screen.getByTestId('invite-story-s1'));
    await fireEvent.press(screen.getByTestId('invite-to-story-confirm'));

    expect(props.onInvite).not.toHaveBeenCalled();
  });

  it('starts over each time it opens', async () => {
    const { props, screen } = await renderModal();
    await fireEvent.press(screen.getByTestId('invite-story-s2'));
    await fireEvent.press(screen.getByTestId('invite-role-writer'));

    await screen.rerender(<InviteToStoryModal {...props} visible={false} />);
    await screen.rerender(<InviteToStoryModal {...props} visible />);

    expect(screen.getByTestId('invite-story-s2').props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId('invite-role-reader').props.accessibilityState.selected).toBe(true);
  });

  it('explains how a story gets to the server when there is none to offer', async () => {
    const { screen } = await renderModal({ stories: [] });

    expect(screen.getByTestId('invite-no-stories')).toBeTruthy();
    expect(screen.queryByTestId('invite-role-writer')).toBeNull();
    // Nothing to send: only the way out is left.
    expect(screen.queryByTestId('invite-to-story-confirm')).toBeNull();
  });

  it('shows no empty message while the stories are still being read', async () => {
    const { screen } = await renderModal({ stories: null });

    expect(screen.queryByTestId('invite-no-stories')).toBeNull();
  });

  it('draws nothing while it is closed', async () => {
    const { screen } = await renderModal({ visible: false });

    expect(screen.queryByTestId('invite-to-story-confirm')).toBeNull();
  });
});
