import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import StatComparisonScreen from '../screens/stats/StatComparisonScreen';
import StatFormScreen from '../screens/stats/StatFormScreen';
import StatLadderScreen from '../screens/stats/StatLadderScreen';
import StatListScreen from '../screens/stats/StatListScreen';
import StatRankingScreen from '../screens/stats/StatRankingScreen';

export type StatsStackParamList = {
  StatList: undefined;
  StatForm: { statId?: string } | undefined;
  /** An absent `statId` = the story's default ladder. */
  StatLadder: { statId?: string } | undefined;
  StatComparison: { characterId?: string; modeId?: string } | undefined;
  StatRanking: { statId?: string } | undefined;
};

const Stack = createNativeStackNavigator<StatsStackParamList>();

export default function StatsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StatList" component={StatListScreen} />
      <Stack.Screen name="StatForm" component={StatFormScreen} />
      <Stack.Screen name="StatLadder" component={StatLadderScreen} />
      <Stack.Screen name="StatComparison" component={StatComparisonScreen} />
      <Stack.Screen name="StatRanking" component={StatRankingScreen} />
    </Stack.Navigator>
  );
}
