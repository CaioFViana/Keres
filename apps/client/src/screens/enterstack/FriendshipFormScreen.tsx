import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import FormField from '@/src/components/common/forms/FormField/FormField';
import Button from '@/src/components/common/controls/Button/Button';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { GuidedEmptyState } from '@/src/components/common/lists/GenericFilterSortList/ListEmptyStates';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { Ionicons } from '@expo/vector-icons';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import type {
  FriendshipStackParamList,
  StorySelectionDrawerParamList,
} from '../../navigation/StorySelectionStack';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { useFriendshipFormActions } from './useFriendshipFormActions';
import { useFriendshipFormResources } from './useFriendshipFormResources';
import { useFriendshipFormState } from './useFriendshipFormState';

type FriendshipFormScreenNavigationProp = NativeStackNavigationProp<
  FriendshipStackParamList,
  'FriendshipList'
>;

/**
 * Add-only: sending a friend request. Status transitions go through
 * FriendshipListScreen / FriendDetailScreen API-backed actions.
 *
 * The tag is looked up as it is typed and the answer shows under the field, so sending is one step
 * after typing: no "check" button and no dialog between the two.
 */
const FriendshipFormScreen = () => {
  const navigation = useNavigation<FriendshipFormScreenNavigationProp>();
  useBackButtonHandler({ showWebBackButton: true });

  const { colors } = useTheme();
  const { t } = useTranslation();
  useScreenHeader({ target: 'parent', title: t('add_new_friendship') });
  const { userId: currentUserId } = useUserSettingsStore();
  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);

  const { friendshipServiceRef, serverServiceRef } = useFriendshipFormResources();
  const friendshipFormState = useFriendshipFormState({ serverServiceRef });
  const {
    friendTag,
    selectedServerId,
    selectedServer,
    servers,
    serversLoaded,
    friendUsername,
    isCheckingFriend,
    friendFound,
    checkFailed,
    handleServerChange,
    handleFriendTagChange,
  } = friendshipFormState;

  const { handleSaveFriendship } = useFriendshipFormActions({
    state: friendshipFormState,
    friendshipServiceRef,
    navigation,
    currentUserId,
  });

  const handleRegisterServer = () => {
    navigation
      .getParent<DrawerNavigationProp<StorySelectionDrawerParamList>>()
      ?.navigate('ServerManagementDrawer', { screen: 'ServerManagement' });
  };

  if (serversLoaded && servers.length === 0) {
    return (
      <View style={commonContainerStyles.container}>
        <GuidedEmptyState
          icon="cloud-outline"
          title={t('friend_form_no_server_title')}
          message={t('friends_empty_no_server_message')}
          actions={[
            {
              label: t('friends_empty_register_server'),
              onPress: handleRegisterServer,
              testID: 'friend-form-register-server',
            },
          ]}
          fallbackText={t('no_servers_available')}
        />
      </View>
    );
  }

  return (
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={styles.content}
    >
      {/* One server is chosen for the person; the picker is only for telling several apart. */}
      {servers.length > 1 && (
        <FormField label={t('server')}>
          <SingleSelectPill
            options={servers.map((server) => ({
              label: server.tag ? `@${server.tag} — ${server.name}` : server.name,
              value: server.id,
            }))}
            value={selectedServerId || null}
            onValueChange={handleServerChange}
            placeholder={t('select_server')}
            multiple={false}
          />
        </FormField>
      )}

      <FormField label={t('friend_id')} help={t('friend_form_hint')}>
        {(accessibility) => (
          <TextInput
            {...accessibility}
            style={commonInputStyles.input}
            placeholder={t('enter_friend_id')}
            value={friendTag}
            onChangeText={handleFriendTagChange}
            onSubmitEditing={handleSaveFriendship}
            returnKeyType="send"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
        )}
      </FormField>

      <View style={styles.status} accessibilityLiveRegion="polite" testID="friend-lookup-status">
        {isCheckingFriend && (
          <>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              {t('friend_form_checking')}
            </Text>
          </>
        )}
        {friendFound === true && friendUsername && (
          <>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <Text style={[styles.statusText, { color: colors.text }]}>
              {t('friend_form_found', { name: friendUsername })}
            </Text>
          </>
        )}
        {friendFound === false && (
          <>
            <Ionicons name="close-circle" size={20} color={colors.error} />
            <Text style={[styles.statusText, { color: colors.error }]}>
              {t('friend_form_not_found')}
            </Text>
          </>
        )}
        {checkFailed && (
          <>
            <Ionicons name="cloud-offline-outline" size={20} color={colors.error} />
            <Text style={[styles.statusText, { color: colors.error }]}>
              {t('friend_form_check_failed')}
            </Text>
          </>
        )}
      </View>

      <Button
        onPress={handleSaveFriendship}
        disabled={!selectedServer || !friendTag.trim() || isCheckingFriend || friendFound === false}
      >
        {t('friend_send_request')}
      </Button>
    </KeyboardAwareScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  // Always tall enough for one line, so the button does not jump when the answer arrives.
  status: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 14,
  },
  statusText: { fontSize: 14, flexShrink: 1 },
});

export default FriendshipFormScreen;
