import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import ServerRegistrationForm, {
  type ServerRegistrationResult,
} from '@/src/screens/enter-stack/servers/ServerRegistrationForm';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { StorySelectionDrawerParamList } from '@/src/navigation/stacks/StorySelectionStack';

type RootStackParamList = {
  ServerRegistration: { serverId?: string; address?: string };
  ServerManagement: undefined;
  ServerVerification: { serverId: string };
};

type ServerRegistrationScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ServerRegistration'
>;

/**
 * Adds a server (sign in, create an account, or recover one) or edits a saved one. The form is the
 * same one the first-use account gate shows; this screen only decides where each ending leads.
 */
const ServerRegistrationScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const navigation = useNavigation<ServerRegistrationScreenNavigationProp>();
  const route =
    useRoute<NativeStackScreenProps<RootStackParamList, 'ServerRegistration'>['route']>();
  const { serverId, address } = route.params || {};
  useScreenHeader({
    target: 'parent',
    title: serverId ? t('edit_server') : t('register_new_server'),
  });

  const onCompleted = useCallback(
    ({ serverId: savedId, needsVerification }: ServerRegistrationResult) => {
      if (savedId && needsVerification)
        navigation.replace('ServerVerification', { serverId: savedId });
      else navigation.goBack();
    },
    [navigation],
  );
  const onClose = useCallback(() => navigation.goBack(), [navigation]);
  const onOpenSettings = useCallback(
    () =>
      navigation
        .getParent<DrawerNavigationProp<StorySelectionDrawerParamList>>()
        ?.navigate('Settings', { screen: 'SettingsHome' }),
    [navigation],
  );

  return (
    <ServerRegistrationForm
      serverId={serverId}
      suggestedAddress={address}
      onCompleted={onCompleted}
      onClose={onClose}
      onOpenSettings={onOpenSettings}
    />
  );
};

export default ServerRegistrationScreen;
