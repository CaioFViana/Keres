import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ServerRegistrationForm, {
  type ServerRegistrationResult,
} from '@/src/screens/enter-stack/servers/ServerRegistrationForm';
import type { RootStackParamList } from '@/src/navigation/AppNavigator';
import { useTheme } from '@/src/theme';
import { useDocumentTitle } from '@/src/utils/nav/documentTitle';

type RequiredAccountNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'RequiredAccount'
>;

/**
 * The gate a server can put in front of the hosted web client: before any story, sign in or create an
 * account on the server that serves the app (the form locks the address to it). There is no way around
 * it from here - the only exits are an account, or the server no longer asking (`AppNavigator` reads that
 * on the next start).
 */
const RequiredAccountScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RequiredAccountNavigationProp>();
  useDocumentTitle(t('required_account_title'));

  const onCompleted = useCallback(
    ({ serverId, needsVerification }: ServerRegistrationResult) => {
      if (serverId && needsVerification) {
        navigation.replace('StorySelection', {
          screen: 'ServerManagementDrawer',
          params: { screen: 'ServerVerification', params: { serverId } },
        });
      } else {
        navigation.replace('StorySelection');
      }
    },
    [navigation],
  );

  // The form's other ending (a saved server that is gone) is not reachable without a server to edit.
  const onClose = useCallback(() => navigation.replace('StorySelection'), [navigation]);

  return (
    <View
      style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}
      testID="required-account-screen"
    >
      <ServerRegistrationForm
        title={t('required_account_title')}
        description={t('required_account_description')}
        onCompleted={onCompleted}
        onClose={onClose}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
});

export default RequiredAccountScreen;
