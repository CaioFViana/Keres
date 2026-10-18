import { render } from '@testing-library/react-native';
import React from 'react';

import ColdInstallNavigator from '@/src/navigation/stacks/ColdInstallStack';
import ColdInstallScreen from '@/src/screens/enter-stack/account/ColdInstallScreen';

const mockNavigatorProps: Record<string, unknown>[] = [];
const mockScreens: Record<string, unknown>[] = [];

jest.mock('@react-navigation/native-stack', () => ({
  __esModule: true,
  createNativeStackNavigator: () => ({
    Navigator: ({ children, ...props }: { children: React.ReactNode }) => {
      mockNavigatorProps.push(props);
      return <>{children}</>;
    },
    Screen: (props: Record<string, unknown>) => {
      mockScreens.push(props);
      return null;
    },
  }),
}));
jest.mock('@/src/screens/enter-stack/account/ColdInstallScreen', () => ({
  __esModule: true,
  default: () => null,
}));

beforeEach(() => {
  mockNavigatorProps.length = 0;
  mockScreens.length = 0;
});

it('registers the cold-install screen without a header', async () => {
  await render(<ColdInstallNavigator />);

  expect(mockNavigatorProps).toEqual([{ screenOptions: { headerShown: false } }]);
  expect(mockScreens).toEqual([{ name: 'ColdInstallScreen', component: ColdInstallScreen }]);
});
