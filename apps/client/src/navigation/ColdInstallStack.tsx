import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ColdInstallScreen from '../screens/ColdInstallScreen';

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
