import { Slot } from 'expo-router'; // Import Slot
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'; // Import useSafeAreaInsets
import { View, StyleSheet } from 'react-native'; // Import View and StyleSheet
import App from '../src/App';

// Create a wrapper component for safe area
const SafeAreaWrapper = ({ children }: { children: React.ReactNode }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {children}
    </View>
  );
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SafeAreaWrapper>
        {/* App component is where all the providers and AppNavigator are rendered */}
        <App />
      </SafeAreaWrapper>
    </SafeAreaProvider>
  );
}