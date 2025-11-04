import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import StorySelectionScreen from '../screens/StorySelectionScreen';

type StorySelectionStackParamList = {
  StorySelectionScreen: undefined;
};

const StorySelectionStack = createNativeStackNavigator<StorySelectionStackParamList>();

const StorySelectionNavigator = () => {
  return (
    <StorySelectionStack.Navigator screenOptions={{ headerShown: false }}>
      <StorySelectionStack.Screen name="StorySelectionScreen" component={StorySelectionScreen} />
    </StorySelectionStack.Navigator>
  );
};

export default StorySelectionNavigator;
