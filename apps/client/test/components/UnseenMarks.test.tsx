/**
 * @jest-environment jsdom
 */
const mockColors = {
  background: '#ffffff',
  error: '#ff0000',
  primary: '#0000ff',
  text: '#111111',
  textSecondary: '#555555',
  card: '#fafafa',
  border: '#cccccc',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text testID={`icon-${name}`}>{name}</Text> };
});
jest.mock('../../src/theme', () => ({
  useTheme: () => ({ isDarkMode: false, colors: mockColors }),
}));
jest.mock('../../src/components/common/display/Avatar/Avatar', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

import { act, fireEvent, render } from '@testing-library/react-native';
import ConversationListItem from '../../src/components/features/messages/ConversationListItem';
import FriendChatButton from '../../src/components/features/messages/FriendChatButton';
import ServerDrawerIcon from '../../src/components/features/messages/ServerDrawerIcon';
import UnseenMark from '../../src/components/features/messages/UnseenMark';
import ServerActionRow from '../../src/components/features/servers/ServerActionRow';
import ServerListItem from '../../src/components/features/servers/ServerListItem';
import { useUnseenMessagesStore } from '../../src/state/unseenMessagesStore';

const setUnseen = (unseen: Record<string, string>) =>
  act(async () => {
    useUnseenMessagesStore.setState({ unseen });
  });

beforeEach(() => {
  useUnseenMessagesStore.getState().reset();
});

describe('UnseenMark', () => {
  it('is a dot with no number and no words, laid over whatever it marks', async () => {
    const view = await render(<UnseenMark testID="mark" />);

    expect(view.getByTestId('mark')).toBeTruthy();
    expect(view.queryByText(/./)).toBeNull();
  });
});

describe('FriendChatButton', () => {
  const button = (onPress = jest.fn()) => (
    <FriendChatButton serverId="srv-1" friendUserId="u1" friendName="Ana" onPress={onPress} />
  );

  it('is the plain chat button, with its usual label, when the friend wrote nothing new', async () => {
    const view = await render(button());

    expect(view.getByTestId('icon-chatbubble-outline')).toBeTruthy();
    expect(view.queryByTestId('friend-unseen-mark')).toBeNull();
    expect(view.getByLabelText('send_message')).toBeTruthy();
  });

  it('says which friend wrote: a filled bubble with a dot, and a label naming them', async () => {
    await setUnseen({ 'srv-1|u1': '09' });
    const view = await render(button());

    expect(view.getByTestId('icon-chatbubble-ellipses')).toBeTruthy();
    expect(view.getByTestId('friend-unseen-mark')).toBeTruthy();
    expect(view.getByLabelText('messages_unseen_from:{"name":"Ana"}')).toBeTruthy();
  });

  it('is not marked by the messages of another friend, of the same friend on another server, or of the administrators', async () => {
    await setUnseen({ 'srv-1|u2': '09', 'srv-2|u1': '09', 'srv-1|admin': '09' });
    const view = await render(button());

    expect(view.queryByTestId('friend-unseen-mark')).toBeNull();
    expect(view.getByTestId('icon-chatbubble-outline')).toBeTruthy();
  });

  it('opens the conversation, and drops the mark as soon as the conversation was opened', async () => {
    const onPress = jest.fn();
    await setUnseen({ 'srv-1|u1': '09' });
    const view = await render(button(onPress));

    await fireEvent.press(view.getByLabelText('messages_unseen_from:{"name":"Ana"}'));
    expect(onPress).toHaveBeenCalledTimes(1);

    await act(async () => {
      await useUnseenMessagesStore.getState().markSeen('srv-1|u1', '09');
    });
    expect(view.queryByTestId('friend-unseen-mark')).toBeNull();
    expect(view.getByLabelText('send_message')).toBeTruthy();
  });
});

describe('ServerDrawerIcon', () => {
  it('is the usual server icon when nothing is waiting, and for the messages of friends', async () => {
    await setUnseen({ 'srv-1|u1': '09' });
    const view = await render(<ServerDrawerIcon color="#000" size={24} />);

    expect(view.getByTestId('icon-server-outline')).toBeTruthy();
    expect(view.queryByTestId('unseen-admin-mark')).toBeNull();
  });

  it('is marked while the administrators of some server have written something unopened', async () => {
    const view = await render(<ServerDrawerIcon color="#000" size={24} />);

    await setUnseen({ 'srv-2|admin': '09' });
    expect(view.getByTestId('unseen-admin-mark')).toBeTruthy();
    expect(view.getByLabelText('messages_unseen_admin')).toBeTruthy();

    await setUnseen({});
    expect(view.queryByTestId('unseen-admin-mark')).toBeNull();
  });
});

describe('ConversationListItem', () => {
  const item = (props: Record<string, unknown> = {}) => (
    <ConversationListItem
      title="Ana"
      subtitle="@ana · Home"
      preview="Hi"
      when="today"
      isAdmin={false}
      avatar={{ color: null, icon: null, seed: 'u1' }}
      onPress={jest.fn()}
      {...props}
    />
  );

  it('is as it always was when nothing is new', async () => {
    const view = await render(item());

    expect(view.queryByTestId('conversation-unseen-mark')).toBeNull();
    expect(view.getByLabelText('Ana')).toBeTruthy();
  });

  it('stands out when the other side wrote last, and says who in its label', async () => {
    const view = await render(item({ unseen: true, unseenLabel: 'New message from Ana' }));

    expect(view.getByTestId('conversation-unseen-mark')).toBeTruthy();
    expect(view.getByLabelText('New message from Ana')).toBeTruthy();
    expect(view.queryByLabelText('Ana')).toBeNull();
  });

  it('keeps its plain label when it is marked but nobody gave it another', async () => {
    const view = await render(item({ unseen: true }));

    expect(view.getByLabelText('Ana')).toBeTruthy();
  });
});

describe('ServerListItem', () => {
  const item = (props: Record<string, unknown> = {}) => (
    <ServerListItem
      name="Home"
      url="https://home.example"
      userName="ana"
      tag="ana"
      lastSync={null}
      status="online"
      apiVersion="1.0"
      onPress={jest.fn()}
      {...props}
    />
  );

  it('shows nothing about messages when the administrators wrote nothing new', async () => {
    const view = await render(item());

    expect(view.queryByTestId('server-unseen-admin')).toBeNull();
    expect(view.getByLabelText('Home')).toBeTruthy();
  });

  it('says which server the administrators wrote from, in words and in its label', async () => {
    const view = await render(item({ hasUnseenAdminMessage: true }));

    expect(view.getByTestId('server-unseen-admin')).toBeTruthy();
    expect(view.getByText('messages_unseen_admin_short')).toBeTruthy();
    expect(view.getByLabelText('Home. messages_unseen_admin_on:{"server":"Home"}')).toBeTruthy();
  });
});

describe('ServerActionRow', () => {
  const row = (props: Record<string, unknown> = {}) => (
    <ServerActionRow
      icon="chatbubbles-outline"
      title="Messages"
      description="Write"
      onPress={jest.fn()}
      {...props}
    />
  );

  it('has no dot by default', async () => {
    const view = await render(row());

    expect(view.queryByTestId('server-action-badge')).toBeNull();
    expect(view.getByLabelText('Messages')).toBeTruthy();
  });

  it('wears a dot, and says what it is, when something new is behind it', async () => {
    const view = await render(row({ badge: true, badgeLabel: 'New message' }));

    expect(view.getByTestId('server-action-badge')).toBeTruthy();
    expect(view.getByLabelText('Messages. New message')).toBeTruthy();
  });

  it('keeps its plain label when it is badged without a label to add', async () => {
    const view = await render(row({ badge: true }));

    expect(view.getByTestId('server-action-badge')).toBeTruthy();
    expect(view.getByLabelText('Messages')).toBeTruthy();
  });
});
