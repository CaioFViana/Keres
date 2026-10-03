const mockHeader = jest.fn();
const mockNavigate = jest.fn();
const mockRoute: { params: { serverId: string; peer: string; peerName?: string } } = {
  params: { serverId: 'srv-1', peer: 'admin' },
};
const mockUseConversation = jest.fn();
const mockKeyboard = { overlap: 0, onLayout: jest.fn() };
const mockUseKeyboardOverlap = jest.fn();
const mockUseMessageInbox = jest.fn();
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
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
    i18n: { language: 'en' },
  }),
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text testID={`icon-${name}`}>{name}</Text> };
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: (...args: unknown[]) => mockNavigate(...args) }),
  useRoute: () => mockRoute,
}));
jest.mock('../../../src/theme', () => {
  const actual = jest.requireActual('../../../src/theme');
  return { ...actual, useTheme: () => ({ isDarkMode: false, colors: mockColors }) };
});
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: (options: unknown) => mockHeader(options),
}));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: () => {} }));
jest.mock('../../../src/guides/useScreenTour', () => ({ useScreenTour: jest.fn() }));
jest.mock('../../../src/guides/useGuideAnchor', () => ({ useScreenAnchor: () => null }));
jest.mock('../../../src/hooks/useKeyboardOverlap', () => ({
  useKeyboardOverlap: (...args: unknown[]) => mockUseKeyboardOverlap(...args),
}));
jest.mock('../../../src/hooks/useConversation', () => ({
  useConversation: (...args: unknown[]) => mockUseConversation(...args),
}));
jest.mock('../../../src/hooks/useMessageInbox', () => ({
  useMessageInbox: () => mockUseMessageInbox(),
}));
jest.mock('@/src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text, View } = require('react-native');
  return {
    SingleSelectPill: ({
      options,
      onValueChange,
      placeholder,
    }: {
      options: { value: string; label: string }[];
      onValueChange: (value: string | null) => void;
      placeholder: string;
    }) => (
      <View>
        <Text>{placeholder}</Text>
        {options.map((option) => (
          <Text key={option.value} onPress={() => onValueChange(option.value)}>
            {option.label}
          </Text>
        ))}
        <Text onPress={() => onValueChange('unknown|x')}>pick-unknown</Text>
      </View>
    ),
  };
});

import { act, fireEvent, render } from '@testing-library/react-native';
import ConversationScreen, {
  keyboardRoom,
  liftAboveKeyboard,
} from '../../../src/screens/enterstack/ConversationScreen';
import MessageInboxScreen from '../../../src/screens/enterstack/MessageInboxScreen';

const conversation = (over: Record<string, unknown> = {}) => ({
  messages: [
    { id: '02', body: 'Second', createdAt: '2026-01-02T10:00:00Z', mine: true },
    { id: '01', body: 'First', createdAt: '2026-01-01T10:00:00Z', mine: false },
  ],
  loading: false,
  loadingMore: false,
  sending: false,
  unavailable: false,
  hasMore: false,
  remainingToday: 4,
  loadOlder: jest.fn(),
  send: jest.fn().mockResolvedValue(true),
  deleteMessage: jest.fn(),
  clear: jest.fn(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseKeyboardOverlap.mockReturnValue({ ...mockKeyboard, ref: { current: null } });
  mockRoute.params = { serverId: 'srv-1', peer: 'admin' };
  mockUseConversation.mockReturnValue(conversation());
});

describe('ConversationScreen', () => {
  describe('the keyboard', () => {
    const paddingBottom = (
      view: ReturnType<typeof render> extends Promise<infer V> ? V : never,
    ) => {
      const style = view.getByTestId('conversation-screen').props.style;
      return (Array.isArray(style) ? style.flat(Infinity) : [style]).reduce(
        (found: number | undefined, entry: { paddingBottom?: number } | undefined) =>
          entry?.paddingBottom ?? found,
        undefined,
      );
    };

    it('measures how much of the bottom the keyboard covers, and watches it', async () => {
      await render(<ConversationScreen />);

      expect(mockUseKeyboardOverlap).toHaveBeenCalledWith(true);
    });

    it('keeps its usual margin below the field while the keyboard is down', async () => {
      const view = await render(<ConversationScreen />);

      expect(paddingBottom(view)).toBe(12);
    });

    it('lifts the field by what the keyboard covers plus a little room, so its last line is not left behind it', async () => {
      mockUseKeyboardOverlap.mockReturnValue({ ...mockKeyboard, overlap: 310 });
      const view = await render(<ConversationScreen />);

      expect(paddingBottom(view)).toBe(12 + 310 + keyboardRoom());
    });

    it('adds that room only while the keyboard is up', () => {
      expect(liftAboveKeyboard(0, 40)).toBe(0);
      expect(liftAboveKeyboard(-5, 40)).toBe(0);
      expect(liftAboveKeyboard(1, 40)).toBe(41);
    });

    it('leaves at least the minimum room on every platform, and the status bar plus a margin when that is more', () => {
      expect(keyboardRoom(0)).toBe(40);
      // A thin status bar does not shrink it below the minimum...
      expect(keyboardRoom(24)).toBe(40);
      // ...and a tall one (or a cutout) grows it: on Android the lift falls short by about the status bar.
      expect(keyboardRoom(48)).toBe(60);
    });

    it('lets the measuring hook see the screen, so the cover can be measured', async () => {
      const view = await render(<ConversationScreen />);

      expect(view.getByTestId('conversation-screen').props.onLayout).toBe(mockKeyboard.onLayout);
      expect(view.getByTestId('conversation-screen').props.collapsable).toBe(false);
    });

    it('lets a tap on a message or on send act at once while the keyboard is open', async () => {
      const view = await render(<ConversationScreen />);

      expect(view.getByTestId('conversation-list').props.keyboardShouldPersistTaps).toBe('handled');
    });
  });

  it("opens the administrators' conversation, with a note on who reads it", async () => {
    const view = await render(<ConversationScreen />);

    expect(mockUseConversation).toHaveBeenCalledWith('srv-1', { kind: 'admin' });
    expect(view.getByText('messages_administrators_hint')).toBeTruthy();
    expect(view.getByText('First')).toBeTruthy();
    expect(view.getByText('Second')).toBeTruthy();
    expect(mockHeader.mock.calls.at(-1)![0].title).toBe('messages_administrators');
  });

  it("opens a friend's conversation titled with their name, without the administrators note", async () => {
    mockRoute.params = { serverId: 'srv-1', peer: 'user-9', peerName: 'Bia' };

    const view = await render(<ConversationScreen />);

    expect(mockUseConversation).toHaveBeenCalledWith('srv-1', { kind: 'direct', userId: 'user-9' });
    expect(mockHeader.mock.calls.at(-1)![0].title).toBe('Bia');
    expect(view.queryByText('messages_administrators_hint')).toBeNull();
  });

  it("falls back to a plain title when the friend's name was not passed", async () => {
    mockRoute.params = { serverId: 'srv-1', peer: 'user-9' };

    await render(<ConversationScreen />);

    expect(mockHeader.mock.calls.at(-1)![0].title).toBe('messages_title');
  });

  it('offers to clear the conversation only when there is something to clear', async () => {
    const clear = jest.fn();
    mockUseConversation.mockReturnValue(conversation({ clear }));
    await render(<ConversationScreen />);
    const action = mockHeader.mock.calls.at(-1)![0].actions[0];
    expect(action).toMatchObject({ icon: 'trash-bin-outline', visible: true });
    action.onPress();
    expect(clear).toHaveBeenCalled();

    mockUseConversation.mockReturnValue(conversation({ messages: [] }));
    await render(<ConversationScreen />);
    expect(mockHeader.mock.calls.at(-1)![0].actions[0].visible).toBe(false);
  });

  it('says there is nothing yet, and that the server is unreachable when it is', async () => {
    mockUseConversation.mockReturnValue(conversation({ messages: [], unavailable: true }));

    const view = await render(<ConversationScreen />);

    expect(view.getByText('conversation_empty')).toBeTruthy();
    // Drawn outside the inverted list and not flipped: a flip came out mirrored on a phone.
    expect(view.getByText('conversation_empty').props.style).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ transform: expect.anything() })]),
    );
    expect(view.queryByTestId('conversation-list')).toBeNull();
    expect(view.getByText('messages_unavailable')).toBeTruthy();
  });

  it('shows only a loading state while the first page is on its way', async () => {
    mockUseConversation.mockReturnValue(conversation({ loading: true }));

    const view = await render(<ConversationScreen />);

    expect(view.queryByText('First')).toBeNull();
  });

  it('deletes a message from its bin, and sends what is written', async () => {
    const state = conversation();
    mockUseConversation.mockReturnValue(state);
    const view = await render(<ConversationScreen />);

    await fireEvent.press(view.getAllByLabelText('message_delete_title')[1]);
    expect(state.deleteMessage).toHaveBeenCalledWith('01');

    await fireEvent.changeText(view.getByLabelText('message_placeholder'), 'Hello');
    await act(async () => {
      await fireEvent.press(view.getByLabelText('message_send'));
    });
    expect(state.send).toHaveBeenCalledWith('Hello');
  });

  it('asks for older messages when the reader reaches the end of the list', async () => {
    const state = conversation({ hasMore: true, loadingMore: true });
    mockUseConversation.mockReturnValue(state);
    const view = await render(<ConversationScreen />);

    await fireEvent(view.getByTestId('conversation-list'), 'endReached');

    expect(state.loadOlder).toHaveBeenCalled();
  });
});

const entry = (over: Record<string, unknown> = {}) => ({
  serverId: 'srv-1',
  serverName: 'Main',
  kind: 'direct',
  userId: 'user-1',
  name: 'Bia',
  tag: 'bia',
  avatarColor: null,
  avatarIcon: null,
  lastMessage: { id: '01', body: 'See you', createdAt: '2026-01-01T10:00:00Z', mine: false },
  ...over,
});

const contacts = [
  { serverId: 'srv-1', serverName: 'Main', kind: 'admin', userId: null, name: '', tag: null },
  {
    serverId: 'srv-1',
    serverName: 'Main',
    kind: 'direct',
    userId: 'user-1',
    name: 'Bia',
    tag: 'bia',
  },
  {
    serverId: 'srv-1',
    serverName: 'Main',
    kind: 'direct',
    userId: 'user-2',
    name: 'Cai',
    tag: null,
  },
];

const inboxState = (over: Record<string, unknown> = {}) => ({
  inbox: {
    entries: [
      entry(),
      entry({
        kind: 'admin',
        userId: null,
        name: '',
        tag: null,
        lastMessage: {
          id: '00',
          body: 'We are on it',
          createdAt: '2026-01-01T09:00:00Z',
          mine: true,
        },
      }),
    ],
    unreachableServerIds: [],
  },
  contacts,
  loading: false,
  reload: jest.fn(),
  ...over,
});

describe('MessageInboxScreen', () => {
  beforeEach(() => {
    mockUseMessageInbox.mockReturnValue(inboxState());
  });

  it('lists every conversation, prefixing what the user wrote themselves', async () => {
    const view = await render(<MessageInboxScreen />);

    expect(view.getByText('Bia')).toBeTruthy();
    expect(view.getByText('@bia · Main')).toBeTruthy();
    expect(view.getByText('See you')).toBeTruthy();
    expect(view.getByText('messages_administrators')).toBeTruthy();
    expect(view.getByText(/messages_you/)).toBeTruthy();
  });

  it('opens a conversation from its row', async () => {
    const view = await render(<MessageInboxScreen />);

    await fireEvent.press(view.getByText('Bia'));
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', {
      serverId: 'srv-1',
      peer: 'user-1',
      peerName: 'Bia',
    });

    await fireEvent.press(view.getByText('messages_administrators'));
    expect(mockNavigate).toHaveBeenLastCalledWith('Conversation', {
      serverId: 'srv-1',
      peer: 'admin',
      peerName: undefined,
    });
  });

  it('has a new message action that opens the picker of everybody the user can write to', async () => {
    const view = await render(<MessageInboxScreen />);
    expect(view.queryByText('message_recipient_placeholder')).toBeNull();

    const action = mockHeader.mock.calls.at(-1)![0].actions[0];
    expect(action).toMatchObject({ icon: 'create-outline' });
    await act(async () => {
      action.onPress();
    });

    expect(view.getByText('message_recipient_placeholder')).toBeTruthy();
    expect(view.getByText(/messages_administrators_on/)).toBeTruthy();
    expect(view.getByText('@bia — Bia (Main)')).toBeTruthy();
    expect(view.getByText('Cai (Main)')).toBeTruthy();
  });

  it('starts a conversation with the person picked, and ignores a pick it does not know', async () => {
    const view = await render(<MessageInboxScreen />);
    await act(async () => {
      mockHeader.mock.calls.at(-1)![0].actions[0].onPress();
    });

    await fireEvent.press(view.getByText('pick-unknown'));
    expect(mockNavigate).not.toHaveBeenCalled();

    await fireEvent.press(view.getByText('Cai (Main)'));
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', {
      serverId: 'srv-1',
      peer: 'user-2',
      peerName: 'Cai',
    });
    // The picker closes once somebody is chosen.
    expect(view.queryByText('message_recipient_placeholder')).toBeNull();
  });

  it('says what to do when there is nobody to write to', async () => {
    mockUseMessageInbox.mockReturnValue(
      inboxState({ contacts: [], inbox: { entries: [], unreachableServerIds: [] } }),
    );
    const view = await render(<MessageInboxScreen />);
    await act(async () => {
      mockHeader.mock.calls.at(-1)![0].actions[0].onPress();
    });

    expect(view.getByText('messages_no_contacts')).toBeTruthy();
    expect(view.getByText('messages_no_conversations')).toBeTruthy();
  });

  it('warns about servers that did not answer', async () => {
    mockUseMessageInbox.mockReturnValue(
      inboxState({ inbox: { entries: [], unreachableServerIds: ['srv-1'] } }),
    );

    const view = await render(<MessageInboxScreen />);

    expect(view.getByText('messages_servers_unreachable')).toBeTruthy();
  });

  it('shows only a loading state at first', async () => {
    mockUseMessageInbox.mockReturnValue(inboxState({ loading: true }));

    const view = await render(<MessageInboxScreen />);

    expect(view.queryByText('Bia')).toBeNull();
  });

  it("shows the administrators of a server with the server's name, with no tag", async () => {
    mockUseMessageInbox.mockReturnValue(
      inboxState({
        inbox: {
          entries: [
            entry({ kind: 'admin', userId: null, name: '', tag: null, serverName: 'Beta' }),
          ],
          unreachableServerIds: [],
        },
      }),
    );

    const view = await render(<MessageInboxScreen />);

    expect(view.getByText('Beta')).toBeTruthy();
  });
});

describe('MessageInboxScreen: which conversation has news', () => {
  const { useUnseenMessagesStore } = require('../../../src/state/unseenMessagesStore');

  beforeEach(() => {
    mockUseMessageInbox.mockReturnValue(inboxState());
    useUnseenMessagesStore.getState().reset();
  });

  afterEach(async () => {
    await act(async () => {
      useUnseenMessagesStore.setState({ unseen: {} });
    });
  });

  it('marks the conversation of the friend who wrote, and only that one', async () => {
    await act(async () => {
      useUnseenMessagesStore.setState({ unseen: { 'srv-1|user-1': '09' } });
    });
    const view = await render(<MessageInboxScreen />);

    expect(view.getAllByTestId('conversation-unseen-mark')).toHaveLength(1);
    expect(view.getByLabelText(/messages_unseen_from.*Bia/)).toBeTruthy();
  });

  it('marks the administrators of the server they wrote from, naming the server', async () => {
    await act(async () => {
      useUnseenMessagesStore.setState({ unseen: { 'srv-1|admin': '09' } });
    });
    const view = await render(<MessageInboxScreen />);

    expect(view.getAllByTestId('conversation-unseen-mark')).toHaveLength(1);
    expect(view.getByLabelText(/messages_unseen_admin_on.*Main/)).toBeTruthy();
  });

  it('marks nothing when nothing is new, and not for a conversation of another server', async () => {
    await act(async () => {
      useUnseenMessagesStore.setState({ unseen: { 'srv-9|user-1': '09' } });
    });
    const view = await render(<MessageInboxScreen />);

    expect(view.queryByTestId('conversation-unseen-mark')).toBeNull();
  });
});
