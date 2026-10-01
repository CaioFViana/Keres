import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ColdInstallScreen from '../screens/enterstack/ColdInstallScreen';

type ColdInstallStackParamList = {
  ColdInstallScreen: undefined;
};

const ColdInstallStack = createNativeStackNavigator<ColdInstallStackParamList>();

/**
 * First-run stack: a single welcome screen that creates the local profile (username,
 * language, theme). `AppNavigator` routes here only when no client settings exist yet;
 * once the profile is created the screen replaces itself with story selection.
 */

const ColdInstallNavigator = () => {
  return (
    <ColdInstallStack.Navigator screenOptions={{ headerShown: false }}>
      <ColdInstallStack.Screen name="ColdInstallScreen" component={ColdInstallScreen} />
    </ColdInstallStack.Navigator>
  );
};

export default ColdInstallNavigator;
