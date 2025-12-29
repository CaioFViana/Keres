import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { Picker } from '@react-native-picker/picker'; // For dropdown selection
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native'; // Import ActivityIndicator
import Button from '../../components/common/Button/Button'; // Custom Button
import TextInput from '../../components/common/TextInput/TextInput';
import { useDrizzle } from '../../db';
import { friendshipApiService } from '../../services/FriendshipApiService'; // Import friendshipApiService
import { createFriendshipService } from '../../services/FriendshipService';
import { createServerService } from '../../services/ServerService'; // Import ServerService
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';

type FriendshipStackParamList = {
  FriendshipList: undefined;
  FriendshipForm: { friendshipId?: string };
};

type FriendshipFormScreenRouteProp = RouteProp<FriendshipStackParamList, 'FriendshipForm'>;
type FriendshipFormScreenNavigationProp = NativeStackNavigationProp<FriendshipStackParamList, 'FriendshipList'>;

const FriendshipFormScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<FriendshipStackParamList, 'FriendshipList'>>();
  const route = useRoute<FriendshipFormScreenRouteProp>();
  const { friendshipId } = route.params || {};

  const { colors } = useTheme();
  const { t } = useTranslation();
  const drizzleClient = useDrizzle();
  const friendshipService = createFriendshipService(drizzleClient);
  const serverService = createServerService(drizzleClient); // Initialize ServerService
  const { userId: currentUserId } = useUserSettingsStore();

  const [friendId, setFriendId] = useState('');
  const [selectedServerId, setSelectedServerId] = useState('');
  const [status, setStatus] = useState<FriendStatus>(FriendStatus.PENDING);
  const [servers, setServers] = useState<{ id: string; name: string; idUser?: string }[]>([]); // Added idUser
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [friendUsername, setFriendUsername] = useState<string | null>(null); // New state for friend's username
  const [isCheckingFriend, setIsCheckingFriend] = useState(false); // New state for loading indicator
  const [friendFound, setFriendFound] = useState<boolean | null>(null); // New state to indicate if friend was found

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);

  useEffect(() => {
    const fetchServersAndFriendship = async () => {
      try {
        const fetchedServers = await serverService.getAllServers();
        setServers(fetchedServers.map(s => ({ id: s.id, name: s.name, idUser: s.idUser }))); // Map idUser

        if (friendshipId) {
          setIsEditingExisting(true);
          const friendship = await friendshipService.getFriendshipById(friendshipId);
          if (friendship) {
            setFriendId(friendship.receiverId); // Assuming receiverId is the friend's ID
            setSelectedServerId(friendship.serverId);
            setStatus(friendship.status);
            setFriendUsername(friendship.friendUsername); // Set friendUsername for editing
            setFriendFound(true); // Assume found if editing existing
          } else {
            Alert.alert(t('error'), t('friendship_not_found'));
            navigation.goBack();
          }
        }
      } catch (error) {
        console.error('Error fetching data for friendship form:', error);
        Alert.alert(t('error'), t('failed_to_load_form_data'));
      }
    };
    fetchServersAndFriendship();
  }, [friendshipId, friendshipService, serverService, navigation, t]);

  const handleCheckFriendId = useCallback(async () => {
    if (!friendId || friendId.length !== 26) { // Basic ULID validation
      Alert.alert(t('error'), t('invalid_friend_id_format'));
      setFriendUsername(null);
      setFriendFound(null);
      return;
    }

    setIsCheckingFriend(true);
    setFriendFound(null); // Reset
    setFriendUsername(null); // Reset
    try {
      const userDetails = await friendshipApiService.getUserDetails(friendId);
      if (userDetails) {
        setFriendUsername(userDetails.username);
        setFriendFound(true);
        Alert.alert(t('success'), t('user_found_with_username', { username: userDetails.username }));
      } else {
        setFriendFound(false);
        Alert.alert(t('error'), t('user_not_found_on_server'));
      }
    } catch (error) {
      console.error('Error checking friend ID:', error);
      Alert.alert(t('error'), t('failed_to_check_user_id'));
      setFriendFound(false);
    } finally {
      setIsCheckingFriend(false);
    }
  }, [friendId, t]);

  const handleSaveFriendship = useCallback(async () => {
    if (!currentUserId) {
      Alert.alert(t('error'), t('not_logged_in'));
      return;
    }
    if (!friendId || !selectedServerId) {
      Alert.alert(t('error'), t('all_fields_required'));
      return;
    }
    if (friendFound === false) { // Prevent saving if friend ID is explicitly not found
      Alert.alert(t('error'), t('friend_not_found_on_server'));
      return;
    }
    if (friendId === currentUserId) { // Prevent friending self
      Alert.alert(t('error'), t('cannot_friend_self'));
      return;
    }
    if (!friendUsername) { // Ensure username is available after check
      Alert.alert(t('error'), t('please_check_friend_id'));
      return;
    }


    try {
      if (friendshipId) {
        // Update existing friendship
        await friendshipService.updateFriendship(friendshipId, {
          status: status,
        });
        Alert.alert(t('success'), t('friendship_updated_successfully'));
      } else {
        // Add new friendship
        const selectedServer = servers.find(s => s.id === selectedServerId);
        if (!selectedServer || !selectedServer.idUser) {
            Alert.alert(t('error'), t('selected_server_invalid'));
            return;
        }
        const currentUserServerId = selectedServer.idUser; // The current user's ID on the selected server

        await friendshipService.addFriendship({
          senderId: currentUserServerId, // Use the current user's ID on the selected server
          receiverId: friendId, // The friend's ID on the selected server (from input)
          serverId: selectedServerId,
          status: FriendStatus.PENDING, // New friendships always start as PENDING
          friendUsername: friendUsername, // Use the fetched username
        });
        
        await friendshipApiService.sendFriendRequest(friendId); // friendId is the targetUserId
        Alert.alert(t('success'), t('friendship_added_successfully'));
      }
      navigation.goBack();
    } catch (error) {
      console.error('Error saving friendship:', error);
      // Log the full error object for detailed debugging
      console.error('FriendshipFormScreen: Detailed error object:', error);
      Alert.alert(t('error'), t('failed_to_save_friendship'));
    }
  }, [currentUserId, friendId, selectedServerId, status, friendshipId, friendshipService, navigation, t, servers, friendUsername, friendFound]); // Added new dependencies


  return (
    <View style={commonContainerStyles.container}>
      <Text style={[styles.title, { color: colors.text }]}>
        {friendshipId ? t('edit_friendship') : t('add_new_friendship')}
      </Text>

      <Text style={[styles.label, { color: colors.text }]}>{t('friend_id')}</Text>
      <View style={styles.inputWithButton}>
        <TextInput
          style={[commonInputStyles.input, styles.friendIdInput]}
          placeholder={t('enter_friend_id')}
          value={friendId}
          onChangeText={(text) => {
            setFriendId(text);
            setFriendUsername(null); // Reset username and found status on change
            setFriendFound(null);
          }}
          editable={!isEditingExisting} // Cannot edit friend ID when editing existing friendship
        />
        {!isEditingExisting && (
          <Button
            onPress={handleCheckFriendId}
            disabled={isCheckingFriend || !friendId || friendId.length !== 26} // Disable button if checking, empty, or invalid length
          >
            {t('check_user')}
          </Button>
        )}
      </View>

      {isCheckingFriend && <ActivityIndicator size="small" color={colors.primary} />}
      {friendFound === true && friendUsername && (
        <Text style={[styles.friendInfo, { color: colors.primary }]}>{t('user_found')}: {friendUsername}</Text>
      )}
      {friendFound === false && friendId.length === 26 && ( // Only show "not found" if ID length is correct
        <Text style={[styles.friendInfo, { color: colors.error }]}>{t('user_not_found')}</Text>
      )}

      <Text style={[styles.label, { color: colors.text }]}>{t('server')}</Text>
      <View style={[commonInputStyles.input, isEditingExisting && { backgroundColor: colors.secondary }]}>
        <Picker
          selectedValue={selectedServerId}
          onValueChange={(itemValue) => setSelectedServerId(itemValue)}
          style={{ color: colors.text }}
          enabled={!isEditingExisting} // Cannot edit server when editing existing friendship
        >
          {servers.length === 0 && <Picker.Item label={t('no_servers_available')} value="" />}
          {servers.map((server) => (
            <Picker.Item key={server.id} label={server.name} value={server.id} />
          ))}
        </Picker>
      </View>

      {friendshipId && ( // Only show status picker when editing
        <>
          <Text style={[styles.label, { color: colors.text }]}>{t('status')}</Text>
          <View style={commonInputStyles.input}>
            <Picker
              selectedValue={status}
              onValueChange={(itemValue: FriendStatus) => setStatus(itemValue)}
              style={{ color: colors.text }}
            >
              {Object.values(FriendStatus)
                .map((s) => ( // Removed .filter(s => s !== FriendStatus.COMMON_FRIEND)
                  <Picker.Item key={s} label={t(s.toLowerCase())} value={s} />
                ))}
            </Picker>
          </View>
        </>
      )}

      <Button
        onPress={handleSaveFriendship}
        disabled={isCheckingFriend || friendFound === false || !friendUsername} // Disable button while checking, if friend not found, or if username not verified
      >
        {friendshipId ? t('save_changes') : t('add_friendship')}
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
