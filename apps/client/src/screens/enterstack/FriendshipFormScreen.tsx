import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import FormField from '@/src/components/common/forms/FormField/FormField';
import Button from '@/src/components/common/controls/Button/Button';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import type { FriendshipStackParamList } from '../../navigation/StorySelectionStack';
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
    servers,
    friendUsername,
    isCheckingFriend,
    friendFound,
    handleServerChange,
    handleFriendTagChange,
  } = friendshipFormState;

  const { handleCheckFriendTag, handleSaveFriendship } = useFriendshipFormActions({
    state: friendshipFormState,
    friendshipServiceRef,
    navigation,
    currentUserId,
  });

  return (
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>{t('add_new_friendship')}</Text>

      <FormField label={t('server')}>
        <SingleSelectPill
          options={servers.map((server) => ({
            label: server.tag ? `@${server.tag} — ${server.name}` : server.name,
            value: server.id,
          }))}
          value={selectedServerId || null}
          onValueChange={handleServerChange}
          placeholder={servers.length === 0 ? t('no_servers_available') : t('select_server')}
          multiple={false}
        />
      </FormField>

      <Text style={[styles.label, { color: colors.text }]}>{t('friend_id')}</Text>
      <View style={styles.inputWithButton}>
        <TextInput
          style={[commonInputStyles.input, styles.friendIdInput]}
          placeholder={t('enter_friend_id')}
          value={friendTag}
          onChangeText={handleFriendTagChange}
          autoCapitalize="none"
        />
        <Button
          onPress={handleCheckFriendTag}
          disabled={isCheckingFriend || !friendTag.trim() || !selectedServerId}
        >
          {t('check_user')}
        </Button>
      </View>

      {isCheckingFriend && <ActivityIndicator size="small" color={colors.primary} />}
      {friendFound === true && friendUsername && (
        <Text style={[styles.friendInfo, { color: colors.primary }]}>
          {t('user_found')}: {friendUsername}
        </Text>
      )}
      {friendFound === false && (
        <Text style={[styles.friendInfo, { color: colors.error }]}>{t('user_not_found')}</Text>
      )}

      <Button
        onPress={handleSaveFriendship}
        disabled={isCheckingFriend || friendFound === false || !friendUsername}
      >
        {t('add_friendship')}
      </Button>
    </KeyboardAwareScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    marginTop: 10,
  },
  friendInfo: {
    fontSize: 14,
    marginTop: -10,
    marginBottom: 10,
    textAlign: 'center',
  },
  inputWithButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  friendIdInput: {
    flex: 1,
    marginRight: 10,
  },
});

export default FriendshipFormScreen;
