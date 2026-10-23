import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ServerRegistrationForm, {
  type ServerRegistrationResult,
} from '@/src/screens/enter-stack/servers/ServerRegistrationForm';
import WelcomeProgress from '@/src/components/features/welcome/WelcomeProgress';
import { WELCOME_PAGES } from '@/src/components/features/welcome/welcomeContent';
import type { RootStackParamList } from '@/src/navigation/AppNavigator';
import { useTheme } from '@/src/theme';
import { useDocumentTitle } from '@/src/utils/nav/documentTitle';

type RequiredAccountNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'RequiredAccount'
>;

/** The welcome's steps and this one after them: where `ColdInstallScreen` counts the account in its dots. */
const STEPS = WELCOME_PAGES.length + 1;
/** Wide enough for the form, narrow enough that its lines stay readable on a desktop window. */
const COLUMN_MAX_WIDTH = 560;

/**
 * The gate a server can put in front of the hosted web client, and the last step of the welcome when it
 * does: before any story, sign in or create an account on the server that serves the app (the form locks
 * the address to it). There is no way around it from here - the only exits are an account, or the server
 * no longer asking (`AppNavigator` reads that on the next start).
 */
const RequiredAccountScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RequiredAccountNavigationProp>();
  useDocumentTitle(t('required_account_title'));
  // The dots read "step N of N" with nothing to scroll: one unit of width, standing on the last step.
  const lastStep = useSharedValue(STEPS - 1);

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
      <View style={styles.column}>
        <View style={styles.progress}>
          <WelcomeProgress current={STEPS - 1} total={STEPS} scrollX={lastStep} pageWidth={1} />
        </View>
        <ServerRegistrationForm
          title={t('required_account_title')}
          description={t('required_account_description')}
          onCompleted={onCompleted}
          onClose={onClose}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: COLUMN_MAX_WIDTH, alignSelf: 'center' },
  progress: { alignItems: 'center', paddingTop: 12 },
});

export default RequiredAccountScreen;
