import { render } from '@testing-library/react-native';
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
      return null;
    },
  }),
}));
jest.mock('../../src/screens/stats/StatComparisonScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/stats/StatFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/stats/StatLadderScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/stats/StatListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/stats/StatRankingScreen', () => ({
  __esModule: true,
  default: () => null,
}));

import StatsStackNavigator from '../../src/navigation/StatsStack';
import StatComparisonScreen from '../../src/screens/stats/StatComparisonScreen';
import StatFormScreen from '../../src/screens/stats/StatFormScreen';
import StatLadderScreen from '../../src/screens/stats/StatLadderScreen';
import StatListScreen from '../../src/screens/stats/StatListScreen';
import StatRankingScreen from '../../src/screens/stats/StatRankingScreen';

beforeEach(() => {
  mockNavigatorProps.length = 0;
  mockScreens.length = 0;
});

it('registers the five stat screens without a header', async () => {
  await render(<StatsStackNavigator />);

  expect(mockNavigatorProps).toEqual([{ screenOptions: { headerShown: false } }]);
  expect(mockScreens).toEqual([
    { name: 'StatList', component: StatListScreen },
    { name: 'StatForm', component: StatFormScreen },
    { name: 'StatLadder', component: StatLadderScreen },
    { name: 'StatComparison', component: StatComparisonScreen },
    { name: 'StatRanking', component: StatRankingScreen },
  ]);
});
