import { act, render } from '@testing-library/react-native';
import React from 'react';

const mockNavigatorProps: Array<Record<string, unknown>> = [];
const mockScreens: Array<Record<string, any>> = [];

jest.mock('@react-navigation/native-stack', () => ({
  __esModule: true,
  createNativeStackNavigator: () => ({
    Navigator: ({ children, ...props }: { children: React.ReactNode }) => {
      mockNavigatorProps.push(props);
      return <>{children}</>;
    },
    Screen: (props: Record<string, any>) => {
      mockScreens.push(props);
      return typeof props.children === 'function' ? props.children() : null;
    },
  }),
}));
jest.mock('../../src/screens/help/HelpIndexScreen', () => ({
  __esModule: true,
  HelpIndexScreen: jest.fn(() => null),
}));
jest.mock('../../src/screens/help/HelpPageScreen', () => ({
  __esModule: true,
  HelpPageScreen: jest.fn(() => null),
}));

import HelpStackNavigator from '../../src/navigation/HelpStack';
import { HelpIndexScreen } from '../../src/screens/help/HelpIndexScreen';
import { HelpPageScreen } from '../../src/screens/help/HelpPageScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigatorProps.length = 0;
  mockScreens.length = 0;
});

it('registers the help index and page without a header', async () => {
  await render(<HelpStackNavigator />);

  expect(mockNavigatorProps).toEqual([{ screenOptions: { headerShown: false } }]);
  expect(mockScreens.map((screen) => screen.name)).toEqual(['HelpIndex', 'HelpPage']);
  expect(mockScreens[1].component).toBe(HelpPageScreen);
});

it('shares collapsible-section state with the index screen', async () => {
  await render(<HelpStackNavigator />);

  expect(HelpIndexScreen).toHaveBeenCalledWith(
    expect.objectContaining({ openSections: { start: true } }),
    undefined,
  );
  const { onOpenSectionsChange } = (HelpIndexScreen as jest.Mock).mock.calls[0][0];

  await act(async () => {
    onOpenSectionsChange({ start: false, writing: true });
  });

  const last = (HelpIndexScreen as jest.Mock).mock.calls.at(-1)[0];
  expect(last.openSections).toEqual({ start: false, writing: true });
});
