import { createNativeStackNavigator } from '@react-navigation/native-stack';
import StoryArcFormScreen from '@/src/screens/customization/StoryArcFormScreen';
import StoryArcListScreen from '@/src/screens/customization/StoryArcListScreen';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';

export type ArcsStackParamList = {
  StoryArcList: undefined;
  StoryArcForm: { arcId?: string };
};
const Stack = createNativeStackNavigator<ArcsStackParamList>();

/** The story's arcs: reached from the dashboard and the arc picker, never from the menu. */
export default function ArcsStackNavigator() {
  useBackButtonHandler();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StoryArcList" component={StoryArcListScreen} />
      <Stack.Screen name="StoryArcForm" component={StoryArcFormScreen} />
    </Stack.Navigator>
  );
}
