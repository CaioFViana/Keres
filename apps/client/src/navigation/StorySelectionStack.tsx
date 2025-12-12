import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next'; // Import useTranslation
import SettingsScreen from '../screens/enterstack/AppSettingsScreen';
import ServerManagementScreen from '../screens/enterstack/ServerManagementScreen';
import ServerRegistrationScreen from '../screens/enterstack/ServerRegistrationScreen'; // Import the new screen
import StoryFormScreen from '../screens/enterstack/StoryFormScreen';
import StorySelectionScreen from '../screens/enterstack/StorySelectionScreen';
import { useTheme } from '../theme'; // Import useTheme

export type StorySelectionStackParamList = {
  StorySelectionScreen: undefined; // Renamed for consistency
  StoryForm: { storyId?: string }; // Keep as is, already handled
  Settings: undefined;
  ServerManagement: undefined;
  ServerRegistration: { serverId?: string }; // Added for editing
};

const StorySelectionStack = createNativeStackNavigator<StorySelectionStackParamList>();

const StorySelectionNavigator = () => {
  const { t } = useTranslation(); // Use useTranslation
  const { colors } = useTheme(); // Use useTheme

  return (
    <StorySelectionStack.Navigator screenOptions={{ 
      headerShown: false,
      headerStyle: { backgroundColor: colors.background }, // Apply theme colors
      headerTintColor: colors.text, // Apply theme colors
    }}>
      <StorySelectionStack.Screen name="StorySelectionScreen" component={StorySelectionScreen} />
      <StorySelectionStack.Screen name="StoryForm" component={StoryFormScreen} />
      <StorySelectionStack.Screen name="Settings" component={SettingsScreen} />
      <StorySelectionStack.Screen 
        name="ServerManagement" 
        component={ServerManagementScreen} 
        options={{ headerShown: false, headerTitle: t('manage_servers') }} // Show header, set title
      />
      <StorySelectionStack.Screen 
        name="ServerRegistration" 
        component={ServerRegistrationScreen} 
        options={({ route }) => ({ 
          headerShown: false, 
          headerTitle: route.params?.serverId ? t('edit_server') : t('register_new_server') 
        })} 
      />
    </StorySelectionStack.Navigator>
  );
};

export default StorySelectionNavigator;
