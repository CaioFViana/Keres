import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import SettingsScreen from '../screens/SettingsScreen';
import StoryFormScreen from '../screens/StoryFormScreen';
import StorySelectionScreen from '../screens/StorySelectionScreen';
import ServerManagementScreen from '../screens/ServerManagementScreen';
import ServerRegistrationScreen from '../screens/ServerRegistrationScreen'; // Import the new screen

export type StorySelectionStackParamList = {
  StorySelectionScreen: undefined;
  StoryForm: undefined;
  Settings: undefined;
  ServerManagement: undefined;
  ServerRegistration: undefined;
};

const StorySelectionStack = createNativeStackNavigator<StorySelectionStackParamList>();

const StorySelectionNavigator = () => {
  return (
    <StorySelectionStack.Navigator screenOptions={{ headerShown: false }}>
      <StorySelectionStack.Screen name="StorySelectionScreen" component={StorySelectionScreen} />
      <StorySelectionStack.Screen name="StoryForm" component={StoryFormScreen} />
      <StorySelectionStack.Screen name="Settings" component={SettingsScreen} />
      <StorySelectionStack.Screen name="ServerManagement" component={ServerManagementScreen} />
      <StorySelectionStack.Screen name="ServerRegistration" component={ServerRegistrationScreen} />
    </StorySelectionStack.Navigator>
  );
};

export default StorySelectionNavigator;
