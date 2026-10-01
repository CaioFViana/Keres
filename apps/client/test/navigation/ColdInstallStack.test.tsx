import { render } from '@testing-library/react-native';
import React from 'react';

const mockNavigatorProps: Array<Record<string, unknown>> = [];
const mockScreens: Array<Record<string, unknown>> = [];

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
jest.mock('../../src/screens/enterstack/ColdInstallScreen', () => ({
  __esModule: true,
  default: () => null,
}));

import ColdInstallNavigator from '../../src/navigation/ColdInstallStack';
import ColdInstallScreen from '../../src/screens/enterstack/ColdInstallScreen';

beforeEach(() => {
  mockNavigatorProps.length = 0;
  mockScreens.length = 0;
});

it('registers the cold-install screen without a header', async () => {
  await render(<ColdInstallNavigator />);

  expect(mockNavigatorProps).toEqual([{ screenOptions: { headerShown: false } }]);
  expect(mockScreens).toEqual([{ name: 'ColdInstallScreen', component: ColdInstallScreen }]);
});
