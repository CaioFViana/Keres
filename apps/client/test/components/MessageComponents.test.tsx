/**
 * @jest-environment jsdom
 */
const mockColors = {
  primary: '#0000ff',
  primaryVariant: '#0000aa',
  primaryContainer: '#e0e0ff',
  onPrimaryContainer: '#000088',
  secondary: '#00aa00',
  secondaryVariant: '#008800',
  onPrimary: '#ffffff',
  onSecondary: '#ffffff',
  onBackground: '#111111',
  onSurface: '#111111',
  text: '#111111',
  textSecondary: '#555555',
  background: '#ffffff',
  surface: '#f5f5f5',
  card: '#fafafa',
  border: '#cccccc',
  error: '#ff0000',
  onError: '#ffffff',
  accent: '#ff8800',
  onAccent: '#000000',
  notification: '#00aaff',
  onNotification: '#000000',
  star: '#ffcc00',
  shadow: '#000000',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => (options ? `${key}:${options.count}` : key),
  }),
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text testID={`icon-${name}`}>{name}</Text> };
});
jest.mock('../../src/theme', () => {
  const actual = jest.requireActual('../../src/theme');
  return { ...actual, useTheme: () => ({ isDarkMode: false, colors: mockColors }) };
});

import { act, fireEvent, render } from '@testing-library/react-native';
import ConversationListItem from '../../src/components/features/messages/ConversationListItem';
import MessageBubble from '../../src/components/features/messages/MessageBubble';
import MessageComposer from '../../src/components/features/messages/MessageComposer';

describe('ConversationListItem', () => {
  const props = {
    title: 'Bia',
    subtitle: '@bia · Main',
    preview: 'See you soon',
    when: '1/2/26, 10:00',
    isAdmin: false,
    avatar: { color: '#abcdef', icon: null, seed: 'user-1' },
  };

  it('shows who the conversation is with, how it last ended, and opens on press', async () => {
    const onPress = jest.fn();
    const view = await render(<ConversationListItem {...props} onPress={onPress} />);

    expect(view.getByText('Bia')).toBeTruthy();
    expect(view.getByText('@bia · Main')).toBeTruthy();
    expect(view.getByText('See you soon')).toBeTruthy();
    expect(view.getByText('1/2/26, 10:00')).toBeTruthy();
    await fireEvent.press(view.getByRole('button'));
    expect(onPress).toHaveBeenCalled();
  });

  it('gives the administrators a look of their own, whatever avatar it was handed', async () => {
    const view = await render(
      <ConversationListItem {...props} isAdmin title="Administrators" onPress={jest.fn()} />,
    );

    expect(view.getByText('Administrators')).toBeTruthy();
  });
});

describe('MessageBubble', () => {
  it('shows the text and time, and deletes from its own bin', async () => {
    const onDelete = jest.fn();
    const view = await render(
      <MessageBubble body="Hello there" mine={false} when="10:00" onDelete={onDelete} />,
    );

    expect(view.getByText('Hello there')).toBeTruthy();
    expect(view.getByText('10:00')).toBeTruthy();
    await fireEvent.press(view.getByLabelText('message_delete_title'));
    expect(onDelete).toHaveBeenCalled();
  });

  it("draws the user's own message too", async () => {
    const view = await render(<MessageBubble body="Mine" mine when="10:01" onDelete={jest.fn()} />);

    expect(view.getByText('Mine')).toBeTruthy();
  });
});

describe('MessageComposer', () => {
  const renderComposer = (over: Partial<React.ComponentProps<typeof MessageComposer>> = {}) => {
    const onSend = jest.fn().mockResolvedValue(true);
    const view = render(
      <MessageComposer
        maxLength={20}
        sending={false}
        remainingToday={null}
        onSend={onSend}
        {...over}
      />,
    );
    return { view, onSend };
  };

  it('counts what is written, and sends it trimmed, clearing the field once it went', async () => {
    const { view, onSend } = renderComposer();
    const composer = await view;
    expect(composer.getByText('0/20')).toBeTruthy();

    await fireEvent.changeText(composer.getByLabelText('message_placeholder'), '  hello  ');
    expect(composer.getByText('9/20')).toBeTruthy();
    await act(async () => {
      await fireEvent.press(composer.getByLabelText('message_send'));
    });

    expect(onSend).toHaveBeenCalledWith('hello');
    expect(composer.getByText('0/20')).toBeTruthy();
  });

  it('keeps what was written when sending failed', async () => {
    const { view, onSend } = renderComposer();
    onSend.mockResolvedValue(false);
    const composer = await view;
    await fireEvent.changeText(composer.getByLabelText('message_placeholder'), 'keep me');

    await act(async () => {
      await fireEvent.press(composer.getByLabelText('message_send'));
    });

    expect(composer.getByText('7/20')).toBeTruthy();
  });

  it('cuts the text at the limit', async () => {
    const { view } = renderComposer();
    const composer = await view;

    await fireEvent.changeText(composer.getByLabelText('message_placeholder'), 'x'.repeat(30));

    expect(composer.getByText('20/20')).toBeTruthy();
  });

  it('sends nothing blank, nothing while sending, and nothing past the daily limit', async () => {
    const blank = renderComposer();
    const blankView = await blank.view;
    await fireEvent.changeText(blankView.getByLabelText('message_placeholder'), '   ');
    await fireEvent.press(blankView.getByLabelText('message_send'));
    expect(blank.onSend).not.toHaveBeenCalled();

    const busy = renderComposer({ sending: true });
    const busyView = await busy.view;
    await fireEvent.changeText(busyView.getByLabelText('message_placeholder'), 'hello');
    await fireEvent.press(busyView.getByLabelText('message_send'));
    expect(busy.onSend).not.toHaveBeenCalled();

    const limited = renderComposer({ remainingToday: 0 });
    const limitedView = await limited.view;
    expect(limitedView.getByText('message_limit_reached')).toBeTruthy();
    await fireEvent.changeText(limitedView.getByLabelText('message_placeholder'), 'hello');
    await fireEvent.press(limitedView.getByLabelText('message_send'));
    expect(limited.onSend).not.toHaveBeenCalled();
  });

  it('says how many messages are left today, when something limits them', async () => {
    const { view } = renderComposer({ remainingToday: 3 });

    expect((await view).getByText('message_remaining_today:3')).toBeTruthy();
  });
});
