import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { HelpIndexScreen } from '../screens/help/HelpIndexScreen';
import { HelpPageScreen } from '../screens/help/HelpPageScreen';
import { storyDeviceLibrary } from '../storyDevices/library';

export type StoryDevicesStackParamList = {
  DeviceIndex: undefined;
  DevicePage: { pageId: string };
};
const Stack = createNativeStackNavigator<StoryDevicesStackParamList>();

export default function StoryDevicesStackNavigator() {
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({ start: true });

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DeviceIndex">
        {() => (
          <HelpIndexScreen
            library={storyDeviceLibrary}
            openSections={openSections}
            onOpenSectionsChange={setOpenSections}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="DevicePage">
        {() => <HelpPageScreen library={storyDeviceLibrary} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
