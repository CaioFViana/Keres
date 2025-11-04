import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ColdInstallStack from './ColdInstallStack';
import StorySelectionStack from './StorySelectionStack';
import MainSystemStack from './MainSystemStack';

type RootStackParamList = {
  ColdInstall: undefined;
  StorySelection: undefined;
  MainSystem: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  // Here we would add logic to determine if cold install is needed
  // For now, let's assume ColdInstall is the initial route
  const initialRouteName: keyof RootStackParamList = 'ColdInstall';

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRouteName}>
      <RootStack.Screen name="ColdInstall" component={ColdInstallStack} />
      <RootStack.Screen name="StorySelection" component={StorySelectionStack} />
      <RootStack.Screen name="MainSystem" component={MainSystemStack} />
    </RootStack.Navigator>
  );
};

export default AppNavigator;
