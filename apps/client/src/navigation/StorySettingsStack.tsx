import { createNativeStackNavigator } from '@react-navigation/native-stack';
import StorySettingsAppearanceScreen from '../screens/storysettings/StorySettingsAppearanceScreen';
import StorySettingsCollaborationScreen from '../screens/storysettings/StorySettingsCollaborationScreen';
import StorySettingsGeneralScreen from '../screens/storysettings/StorySettingsGeneralScreen';
import StorySettingsIndexScreen from '../screens/storysettings/StorySettingsIndexScreen';
import { useBackButtonHandler } from '../hooks/useBackButtonHandler';

export type StorySettingsStackParamList = {
  StorySettingsIndex: undefined;
  StorySettingsGeneral: undefined;
  StorySettingsAppearance: undefined;
  StorySettingsCollaboration: undefined;
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
    </Stack.Navigator>
  );
}
