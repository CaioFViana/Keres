import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import DefaultServerCard from '@/src/components/features/servers/DefaultServerCard';

jest.mock('@/src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      card: '#fff',
      primary: '#00f',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('@/src/components/common/controls/Button/Button', () => {
  const ReactActual = require('react');
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      children,
      onPress,
      testID,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      testID?: string;
    }) => ReactActual.createElement(Text, { testID, onPress }, children),
  };
});

describe('DefaultServerCard', () => {
  it('invites to the official server, with the address and what an account is for', async () => {
    const screen = await render(<DefaultServerCard url="https://keres.me" onPress={jest.fn()} />);

    expect(screen.getByTestId('default-server-card')).toBeTruthy();
    expect(screen.getByText('default_server_title')).toBeTruthy();
    expect(screen.queryByText('default_server_title_hosted')).toBeNull();
    expect(screen.getByText('https://keres.me')).toBeTruthy();
    expect(screen.getByText('default_server_invite')).toBeTruthy();
    expect(screen.getByText('default_server_invite_detail')).toBeTruthy();
  });

  it("names the hosted web client's own server when hosted", async () => {
    const screen = await render(
      <DefaultServerCard url="https://host.example" hosted onPress={jest.fn()} />,
    );

    expect(screen.getByText('default_server_title_hosted')).toBeTruthy();
    expect(screen.queryByText('default_server_title')).toBeNull();
    expect(screen.getByText('https://host.example')).toBeTruthy();
  });

  it('leads to signing in on the CTA, and only then', async () => {
    const onPress = jest.fn();
    const screen = await render(<DefaultServerCard url="https://keres.me" onPress={onPress} />);

    expect(onPress).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('default-server-cta'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('default_server_cta')).toBeTruthy();
  });
});
