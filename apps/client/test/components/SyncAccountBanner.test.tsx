import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import SyncAccountBanner from '@/src/components/features/servers/SyncAccountBanner';

jest.mock('@/src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      primary: '#00f',
      primaryContainer: '#e0e0ff',
      onPrimaryContainer: '#000088',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('@/src/hooks/ui/useResponsiveLayout', () => ({
  __esModule: true,
  useResponsiveLayout: () => ({ isCompact: false, isMedium: false, isWide: true }),
}));

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

describe('SyncAccountBanner', () => {
  it('says what an account is for, with its two answers', async () => {
    const screen = await render(
      <SyncAccountBanner onCreateAccount={jest.fn()} onLater={jest.fn()} />,
    );

    expect(screen.getByTestId('sync-account-banner')).toBeTruthy();
    expect(screen.getByText('sync_prompt_title')).toBeTruthy();
    expect(screen.getByText('sync_prompt_message')).toBeTruthy();
    expect(screen.getByTestId('sync-account-banner-action')).toBeTruthy();
    expect(screen.getByText('sync_prompt_action')).toBeTruthy();
    expect(screen.getByTestId('sync-account-banner-later')).toBeTruthy();
    expect(screen.getByText('sync_prompt_later')).toBeTruthy();
  });

  it('goes to account creation from the action, and only from it', async () => {
    const onCreateAccount = jest.fn();
    const onLater = jest.fn();
    const screen = await render(
      <SyncAccountBanner onCreateAccount={onCreateAccount} onLater={onLater} />,
    );

    await fireEvent.press(screen.getByTestId('sync-account-banner-action'));

    expect(onCreateAccount).toHaveBeenCalledTimes(1);
    expect(onLater).not.toHaveBeenCalled();
  });

  it('is answered "not now" from the later link, and only from it', async () => {
    const onCreateAccount = jest.fn();
    const onLater = jest.fn();
    const screen = await render(
      <SyncAccountBanner onCreateAccount={onCreateAccount} onLater={onLater} />,
    );

    await fireEvent.press(screen.getByTestId('sync-account-banner-later'));

    expect(onLater).toHaveBeenCalledTimes(1);
    expect(onCreateAccount).not.toHaveBeenCalled();
  });
});
