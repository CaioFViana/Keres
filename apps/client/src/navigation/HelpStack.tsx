import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { HelpIndexScreen } from '../screens/help/HelpIndexScreen';
import { HelpPageScreen } from '../screens/help/HelpPageScreen';

export type HelpStackParamList = { HelpIndex: undefined; HelpPage: { pageId: string } };
const Stack = createNativeStackNavigator<HelpStackParamList>();
export default function HelpStackNavigator() {
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({ start: true });

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HelpIndex">
        {() => (
          <HelpIndexScreen
            openSections={openSections}
            onOpenSectionsChange={setOpenSections}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="HelpPage" component={HelpPageScreen} />
    </Stack.Navigator>
  );
}
