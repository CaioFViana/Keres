import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useBackButtonHandler } from '../hooks/useBackButtonHandler';
import StoryPublishScreen from '../screens/storyshare/StoryPublishScreen';
import StoryShareIndexScreen from '../screens/storyshare/StoryShareIndexScreen';

export type StoryShareStackParamList = {
  StoryShareIndex: undefined;
  StoryPublish: undefined;
};
const Stack = createNativeStackNavigator<StoryShareStackParamList>();

/** Where the story leaves the app: the page to publish it on, the manuscript document, the copy to keep. */
export default function StoryShareStackNavigator() {
  useBackButtonHandler();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StoryShareIndex" component={StoryShareIndexScreen} />
      <Stack.Screen name="StoryPublish" component={StoryPublishScreen} />
    </Stack.Navigator>
  );
}
