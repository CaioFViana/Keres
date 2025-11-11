import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import SettingsScreen from '../screens/SettingsScreen'; // Import SettingsScreen
import StoryFormScreen from '../screens/StoryFormScreen';
import StorySelectionScreen from '../screens/StorySelectionScreen';

type StorySelectionStackParamList = {
  StorySelectionScreen: undefined;
  StoryForm: undefined;
  Settings: undefined; // Added Settings to the stack
};

const StorySelectionStack = createNativeStackNavigator<StorySelectionStackParamList>();

const StorySelectionNavigator = () => {
  return (
    <StorySelectionStack.Navigator screenOptions={{ headerShown: false }}>
      <StorySelectionStack.Screen name="StorySelectionScreen" component={StorySelectionScreen} />
      <StorySelectionStack.Screen name="StoryForm" component={StoryFormScreen} />
      <StorySelectionStack.Screen name="Settings" component={SettingsScreen} />
    </StorySelectionStack.Navigator>
  );
};

export default StorySelectionNavigator;
