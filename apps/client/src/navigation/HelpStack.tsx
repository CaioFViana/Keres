import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { HelpIndexScreen } from '../screens/help/HelpIndexScreen';
import { HelpPageScreen } from '../screens/help/HelpPageScreen';

export type HelpStackParamList = {
  HelpIndex: undefined;
  /** `returnDrawerRoute` returns to the drawer route whose help shortcut opened this page. */
  HelpPage: { pageId: string; returnDrawerRoute?: string };
};
const Stack = createNativeStackNavigator<HelpStackParamList>();
/**
 * In-app manual: index plus one page per article, mounted in both drawers. Each page takes
 * an optional `returnDrawerRoute` so the drawer's help shortcut can send the reader back
 * to the screen whose shortcut opened the page.
 */
export default function HelpStackNavigator() {
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({ start: true });

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HelpIndex">
        {() => (
          <HelpIndexScreen openSections={openSections} onOpenSectionsChange={setOpenSections} />
        )}
      </Stack.Screen>
      <Stack.Screen name="HelpPage" component={HelpPageScreen} />
    </Stack.Navigator>
  );
}
