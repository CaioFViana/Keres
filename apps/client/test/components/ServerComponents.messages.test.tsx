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
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
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

import { fireEvent, render } from '@testing-library/react-native';
import ServerActionRow from '../../src/components/features/servers/ServerActionRow';
import ServerListItem from '../../src/components/features/servers/ServerListItem';
import ServerStatusPill from '../../src/components/features/servers/ServerStatusPill';

describe('ServerStatusPill', () => {
  it.each([
    ['idle', 'server_status_idle'],
    ['pending', 'server_status_checking'],
    ['offline', 'server_status_offline'],
  ] as const)('says %s in words', async (status, key) => {
    const view = await render(<ServerStatusPill status={status} apiVersion="1.0.0" />);

    expect(view.getByText(key)).toBeTruthy();
  });

  it('adds the API version, only for a server that answers', async () => {
    const online = await render(<ServerStatusPill status="online" apiVersion="1.2.3" />);
    expect(online.getByText(/server_status_online.*1\.2\.3/)).toBeTruthy();

    const noVersion = await render(<ServerStatusPill status="online" apiVersion={null} />);
    expect(noVersion.getByText('server_status_online')).toBeTruthy();
  });
});

describe('ServerListItem', () => {
  const props = {
    name: 'Main',
    url: 'https://a.example',
    userName: 'alice',
    tag: 'alice',
    lastSync: '1/2/26',
    status: 'online' as const,
    apiVersion: '1.2.3',
  };

  it('shows where the server is, who the user is there, and opens on press', async () => {
    const onPress = jest.fn();
    const view = await render(<ServerListItem {...props} onPress={onPress} />);

    expect(view.getByText('Main')).toBeTruthy();
    expect(view.getByText('https://a.example')).toBeTruthy();
    expect(view.getByText(/server_user_label.*alice.*@alice/)).toBeTruthy();
    expect(view.getByText(/last_sync/)).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Main'));
    expect(onPress).toHaveBeenCalled();
  });

  it('says there is no tag, and omits the last sync when there never was one', async () => {
    const view = await render(
      <ServerListItem {...props} tag={null} lastSync={null} onPress={jest.fn()} />,
    );

    expect(view.getByText(/no_tag_set/)).toBeTruthy();
    expect(view.queryByText(/last_sync/)).toBeNull();
  });
});

describe('ServerActionRow', () => {
  it('shows what the action is and does, and runs on press', async () => {
    const onPress = jest.fn();
    const view = await render(
      <ServerActionRow
        icon="key-outline"
        title="Password"
        description="Change it"
        onPress={onPress}
        testID="row"
      />,
    );

    expect(view.getByText('Password')).toBeTruthy();
    expect(view.getByText('Change it')).toBeTruthy();
    await fireEvent.press(view.getByTestId('row'));
    expect(onPress).toHaveBeenCalled();
  });

  it('draws the destructive one apart', async () => {
    const view = await render(
      <ServerActionRow
        icon="trash-outline"
        title="Remove"
        description="Forget it"
        destructive
        onPress={jest.fn()}
      />,
    );

    expect(view.getByText('Remove')).toBeTruthy();
  });
});
