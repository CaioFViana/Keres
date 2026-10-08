import type { StorySchemaEntityType } from '@keres/shared';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import StorySettingsAppearanceScreen from '../screens/storysettings/StorySettingsAppearanceScreen';
import StorySettingsCollaborationScreen from '../screens/storysettings/StorySettingsCollaborationScreen';
import StorySettingsGeneralScreen from '../screens/storysettings/StorySettingsGeneralScreen';
import StorySettingsIndexScreen from '../screens/storysettings/StorySettingsIndexScreen';
import StorySchemaFieldFormScreen from '../screens/storyschema/StorySchemaFieldFormScreen';
import StorySchemaListScreen from '../screens/storyschema/StorySchemaListScreen';
import SuggestionsScreen from '../screens/suggestions/SuggestionsScreen';
import SuggestionUsageScreen from '../screens/suggestions/SuggestionUsageScreen';
import VocabularyScreen from '../screens/customization/VocabularyScreen';
import { useBackButtonHandler } from '../hooks/useBackButtonHandler';

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
