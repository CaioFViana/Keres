import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import ColdInstallScreen from '../screens/enterstack/ColdInstallScreen';

type ColdInstallStackParamList = {
  ColdInstallScreen: undefined;
};

const ColdInstallStack = createNativeStackNavigator<ColdInstallStackParamList>();

const ColdInstallNavigator = () => {
  return (
    <ColdInstallStack.Navigator screenOptions={{ headerShown: false }}>
      <ColdInstallStack.Screen name="ColdInstallScreen" component={ColdInstallScreen} />
    </ColdInstallStack.Navigator>
  );
};

export default ColdInstallNavigator;
