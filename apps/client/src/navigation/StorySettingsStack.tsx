import type { StorySchemaEntityType } from '@keres/shared';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import StorySettingsAppearanceScreen from '@/src/screens/storysettings/StorySettingsAppearanceScreen';
import StorySettingsCollaborationScreen from '@/src/screens/storysettings/StorySettingsCollaborationScreen';
import StorySettingsGeneralScreen from '@/src/screens/storysettings/StorySettingsGeneralScreen';
import StorySettingsIndexScreen from '@/src/screens/storysettings/StorySettingsIndexScreen';
import StorySchemaFieldFormScreen from '@/src/screens/storyschema/StorySchemaFieldFormScreen';
import StorySchemaListScreen from '@/src/screens/storyschema/StorySchemaListScreen';
import SuggestionsScreen from '@/src/screens/suggestions/SuggestionsScreen';
import SuggestionUsageScreen from '@/src/screens/suggestions/SuggestionUsageScreen';
import VocabularyScreen from '@/src/screens/customization/VocabularyScreen';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';

export type StorySettingsStackParamList = {
  StorySettingsIndex: undefined;
  StorySettingsGeneral: undefined;
  StorySettingsAppearance: undefined;
  StorySettingsCollaboration: undefined;
  Vocabulary: undefined;
  StorySchemaList: undefined;
  StorySchemaFieldForm: { entityType: StorySchemaEntityType; fieldId?: string };
  Suggestions: undefined;
  SuggestionUsage: { type: string; value: string };
};
const Stack = createNativeStackNavigator<StorySettingsStackParamList>();

/** The story's settings: a list of sections, each its own screen with its own save. */
export default function StorySettingsStackNavigator() {
  useBackButtonHandler();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StorySettingsIndex" component={StorySettingsIndexScreen} />
      <Stack.Screen name="StorySettingsGeneral" component={StorySettingsGeneralScreen} />
      <Stack.Screen name="StorySettingsAppearance" component={StorySettingsAppearanceScreen} />
      <Stack.Screen
        name="StorySettingsCollaboration"
        component={StorySettingsCollaborationScreen}
      />
      <Stack.Screen name="Vocabulary" component={VocabularyScreen} />
      <Stack.Screen name="StorySchemaList" component={StorySchemaListScreen} />
      <Stack.Screen name="StorySchemaFieldForm" component={StorySchemaFieldFormScreen} />
      <Stack.Screen name="Suggestions" component={SuggestionsScreen} />
      <Stack.Screen name="SuggestionUsage" component={SuggestionUsageScreen} />
    </Stack.Navigator>
  );
}
