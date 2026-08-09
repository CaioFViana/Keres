import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'; // Import ActivityIndicator
import Button from '@/src/components/common/controls/Button/Button'; // Custom Button
import Select from '@/src/components/common/inputs/Select/Select';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { ServerSelect } from '../../db/schemas/servers';
import { FriendshipStackParamList } from '../../navigation/StorySelectionStack';
import { friendshipApiService } from '../../services/FriendshipApiService'; // Import friendshipApiService
import { createFriendshipService } from '../../services/FriendshipService';
import { createServerService } from '../../services/ServerService'; // Import ServerService
import { userApiService } from '../../services/UserApiService';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';

type FriendshipFormScreenNavigationProp = NativeStackNavigationProp<FriendshipStackParamList, 'FriendshipList'>;

/**
 * Add-only: sending a friend request. All status transitions (accept/decline/cancel/unfriend/
 * blacklist/unblacklist) go through `FriendshipListScreen`/`FriendDetailScreen`'s proper
 * API-backed actions instead - this screen used to also expose a raw status `Picker` in an
 * "edit" mode that wrote `friendships.status` directly to the local DB, bypassing every one of
 * those API calls and letting local/server state silently diverge.
 */
const FriendshipFormScreen = () => {
  const navigation = useNavigation<FriendshipFormScreenNavigationProp>();
  useBackButtonHandler({ showWebBackButton: true });

  const { colors } = useTheme();
  const { t } = useTranslation();
  const drizzleClient = useDrizzle();
  // Stable references: recreating these every render would change their identity, which sits
  // in the effect/callback dependency arrays below and would otherwise re-trigger them forever.
  const friendshipService = useRef(createFriendshipService(drizzleClient)).current;
  const serverService = useRef(createServerService(drizzleClient)).current;
  const { userId: currentUserId } = useUserSettingsStore();

  const [friendTag, setFriendTag] = useState('');
  const [resolvedFriendUserId, setResolvedFriendUserId] = useState<string | null>(null);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [servers, setServers] = useState<ServerSelect[]>([]);
  const [friendUsername, setFriendUsername] = useState<string | null>(null); // New state for friend's username
  const [isCheckingFriend, setIsCheckingFriend] = useState(false); // New state for loading indicator
  const [friendFound, setFriendFound] = useState<boolean | null>(null); // New state to indicate if friend was found

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const fetchedServers = await serverService.getAllServers();
        setServers(fetchedServers);
        if (fetchedServers.length === 1) {
          setSelectedServerId(fetchedServers[0].id); // Only one server: pick it automatically
        }
      } catch (error) {
        console.error('Error fetching servers for friendship form:', error);
        AppAlert.alert(t('error'), t('failed_to_load_form_data'));
      }
    };
    fetchServers();
  }, [serverService, t]);

  const selectedServer = servers.find(s => s.id === selectedServerId);

  const handleCheckFriendTag = useCallback(async () => {
    if (!friendTag || friendTag.trim().length < 3) {
      AppAlert.alert(t('error'), t('invalid_friend_id_format'));
      setFriendUsername(null);
      setFriendFound(null);
      return;
    }

    if (!selectedServer) {
      AppAlert.alert(t('error'), t('selected_server_invalid'));
      return;
    }

    setIsCheckingFriend(true);
    setFriendFound(null); // Reset
    setFriendUsername(null); // Reset
    setResolvedFriendUserId(null);
    try {
      const userDetails = await userApiService.getUserByTag(selectedServer, friendTag.trim());
      if (userDetails) {
        setFriendUsername(userDetails.username);
        setResolvedFriendUserId(userDetails.id);
        setFriendFound(true);
        AppAlert.alert(t('success'), t('user_found_with_username', { username: userDetails.username }));
      } else {
        setFriendFound(false);
        AppAlert.alert(t('error'), t('user_not_found_on_server'));
      }
    } catch (error) {
      console.error('Error checking friend tag:', error);
      AppAlert.alert(t('error'), t('failed_to_check_user_id'));
      setFriendFound(false);
    } finally {
      setIsCheckingFriend(false);
    }
  }, [friendTag, selectedServer, t]);

  const handleSaveFriendship = useCallback(async () => {
    if (!currentUserId) {
      AppAlert.alert(t('error'), t('not_logged_in'));
      return;
    }
    if (!resolvedFriendUserId || !selectedServerId) {
      AppAlert.alert(t('error'), t('all_fields_required'));
      return;
    }
    if (friendFound === false) { // Prevent saving if friend tag is explicitly not found
      AppAlert.alert(t('error'), t('friend_not_found_on_server'));
      return;
    }
    if (!friendUsername) { // Ensure username is available after check
      AppAlert.alert(t('error'), t('please_check_friend_id'));
      return;
    }
    if (!selectedServer || !selectedServer.idUser) {
      AppAlert.alert(t('error'), t('selected_server_invalid'));
      return;
    }

    try {
      const currentUserServerId = selectedServer.idUser; // The current user's ID on the selected server

      // Compare per-server IDs, not the local app-installation currentUserId (a
      // different ID namespace entirely) - otherwise this check can never fire.
      if (resolvedFriendUserId === currentUserServerId) {
        AppAlert.alert(t('error'), t('cannot_friend_self'));
        return;
      }

      // Call the server first: if it rejects the request (already friends, blocked,
      // wrong server, etc.) we must not leave an orphaned local PENDING row behind.
      await friendshipApiService.sendFriendRequest(selectedServer, resolvedFriendUserId);

      await friendshipService.addFriendship({
        senderId: currentUserServerId, // Use the current user's ID on the selected server
        receiverId: resolvedFriendUserId, // The friend's ID on the selected server (resolved from their tag)
        serverId: selectedServerId,
        status: FriendStatus.PENDING, // New friendships always start as PENDING
        friendUsername: friendUsername, // Use the fetched username
      });

      AppAlert.alert(t('success'), t('friendship_added_successfully'));
      navigation.goBack();
    } catch (error) {
      console.error('Error saving friendship:', error);
      AppAlert.alert(t('error'), t('failed_to_save_friendship'));
    }
  }, [currentUserId, resolvedFriendUserId, selectedServerId, selectedServer, friendshipService, navigation, t, friendUsername, friendFound]);


  return (
    <View style={commonContainerStyles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{t('add_new_friendship')}</Text>

      <Text style={[styles.label, { color: colors.text }]}>{t('server')}</Text>
      <Select
        options={servers.map((server) => ({
          label: server.tag ? `@${server.tag} — ${server.name}` : server.name,
          value: server.id,
        }))}
        value={selectedServerId || null}
        onValueChange={(itemValue) => {
          setSelectedServerId(itemValue || '');
          // Changing the server invalidates any tag already checked against the previous one.
          setFriendUsername(null);
          setFriendFound(null);
          setResolvedFriendUserId(null);
        }}
        placeholder={servers.length === 0 ? t('no_servers_available') : t('select_server')}
        multiple={false}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('friend_id')}</Text>
      <View style={styles.inputWithButton}>
        <TextInput
          style={[commonInputStyles.input, styles.friendIdInput]}
          placeholder={t('enter_friend_id')}
          value={friendTag}
          onChangeText={(text) => {
            setFriendTag(text);
            setFriendUsername(null); // Reset username and found status on change
            setFriendFound(null);
            setResolvedFriendUserId(null);
          }}
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
        <Text style={[styles.friendInfo, { color: colors.primary }]}>{t('user_found')}: {friendUsername}</Text>
      )}
      {friendFound === false && (
        <Text style={[styles.friendInfo, { color: colors.error }]}>{t('user_not_found')}</Text>
      )}

      <Button
        onPress={handleSaveFriendship}
        disabled={isCheckingFriend || friendFound === false || !friendUsername} // Disable button while checking, if friend not found, or if username not verified
      >
        {t('add_friendship')}
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
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
