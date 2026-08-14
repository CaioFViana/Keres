import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { HelpIndexScreen, HelpPageScreen } from '../screens/help/HelpScreens';

export type HelpStackParamList = { HelpIndex: undefined; HelpPage: { pageId: string } };
const Stack = createNativeStackNavigator<HelpStackParamList>();
export default function HelpStackNavigator() { return <Stack.Navigator screenOptions={{headerShown:false}}><Stack.Screen name="HelpIndex" component={HelpIndexScreen}/><Stack.Screen name="HelpPage" component={HelpPageScreen}/></Stack.Navigator>; }
