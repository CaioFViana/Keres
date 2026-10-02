/**
 * @jest-environment jsdom
 */
const mockColors = { background: '#ffffff', error: '#ff0000' };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text testID={`icon-${name}`}>{name}</Text> };
});
jest.mock('../../src/theme', () => ({
  useTheme: () => ({ isDarkMode: false, colors: mockColors }),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

import { act, render } from '@testing-library/react-native';
import FriendshipDrawerIcon from '../../src/components/features/messages/FriendshipDrawerIcon';
import { useUnseenMessagesStore } from '../../src/state/unseenMessagesStore';

beforeEach(() => {
  useUnseenMessagesStore.getState().reset();
});

describe('FriendshipDrawerIcon', () => {
  it('is the usual people icon when nothing is waiting', async () => {
    const view = await render(<FriendshipDrawerIcon color="#000" size={24} />);

    expect(view.getByTestId('icon-people-outline')).toBeTruthy();
    expect(view.queryByTestId('unseen-messages-mark')).toBeNull();
    expect(view.queryByLabelText('messages_unseen')).toBeNull();
  });

  it('adds a received-message mark while a message has not been opened, and drops it once it was', async () => {
    const view = await render(<FriendshipDrawerIcon color="#000" size={24} />);

    await act(async () => {
      useUnseenMessagesStore.setState({ unseen: { 'srv-1|u1': '09' } });
    });
    expect(view.getByTestId('icon-people-outline')).toBeTruthy();
    expect(view.getByTestId('unseen-messages-mark')).toBeTruthy();
    expect(view.getByTestId('icon-chatbubble')).toBeTruthy();
    expect(view.getByLabelText('messages_unseen')).toBeTruthy();

    await act(async () => {
      useUnseenMessagesStore.setState({ unseen: {} });
    });
    expect(view.queryByTestId('unseen-messages-mark')).toBeNull();
  });
});
