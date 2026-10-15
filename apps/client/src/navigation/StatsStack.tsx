import { createNativeStackNavigator } from '@react-navigation/native-stack';
import StatComparisonScreen from '@/src/screens/stats/StatComparisonScreen';
import StatFormScreen from '@/src/screens/stats/StatFormScreen';
import StatLadderScreen from '@/src/screens/stats/StatLadderScreen';
import StatListScreen from '@/src/screens/stats/StatListScreen';
import StatRankingScreen from '@/src/screens/stats/StatRankingScreen';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';

export type StatsStackParamList = {
  StatList: undefined;
  StatForm: { statId?: string } | undefined;
  /** An absent `statId` = the story's default ladder. */
  StatLadder: { statId?: string } | undefined;
  StatComparison: { characterId?: string; modeId?: string } | undefined;
  StatRanking: { statId?: string } | undefined;
};
const Stack = createNativeStackNavigator<StatsStackParamList>();

/** The story's stat system: its stats, ladders, comparisons and rankings. */
export default function StatsStackNavigator() {
  useBackButtonHandler();
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
