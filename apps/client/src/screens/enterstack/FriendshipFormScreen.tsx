import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { Picker } from '@react-native-picker/picker'; // For dropdown selection
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
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
  const navigation = useNavigation<FriendshipFormScreenNavigationProp>();
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

  const handleSaveFriendship = useCallback(async () => {
    if (!currentUserId) {
      Alert.alert(t('error'), t('not_logged_in'));
      return;
    }
    if (!friendId || !selectedServerId) {
      Alert.alert(t('error'), t('all_fields_required'));
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

        // Log the data being sent to the local DB
        console.log('FriendshipFormScreen: Attempting to add friendship locally with:', {
          senderId: currentUserServerId,
          receiverId: friendId,
          serverId: selectedServerId,
          status: FriendStatus.PENDING,
          friendUsername: friendId,
        });

        await friendshipService.addFriendship({
          senderId: currentUserServerId, // Use the current user's ID on the selected server
          receiverId: friendId, // The friend's ID on the selected server (from input)
          serverId: selectedServerId,
          status: FriendStatus.PENDING, // New friendships always start as PENDING
          friendUsername: friendId, // Placeholder for friend's username, will be updated by sync
        });
        console.log('FriendshipFormScreen: Successfully added friendship locally.');
        
        // NEW: Send friend request to API
        console.log('FriendshipFormScreen: Attempting to send friend request to API for targetUserId:', friendId);
        const apiResponse = await friendshipApiService.sendFriendRequest(friendId); // friendId is the targetUserId
        console.log('FriendshipFormScreen: API response for friend request:', apiResponse);

        Alert.alert(t('success'), t('friendship_added_successfully'));
      }
      navigation.goBack();
    } catch (error) {
      console.error('Error saving friendship:', error);
      // Log the full error object for detailed debugging
      console.error('FriendshipFormScreen: Detailed error object:', error);
      Alert.alert(t('error'), t('failed_to_save_friendship'));
    }
  }, [currentUserId, friendId, selectedServerId, status, friendshipId, friendshipService, navigation, t, servers]); // Added 'servers' to dependencies


  return (
    <View style={commonContainerStyles.container}>
      <Text style={[styles.title, { color: colors.text }]}>
        {friendshipId ? t('edit_friendship') : t('add_new_friendship')}
      </Text>

      <Text style={[styles.label, { color: colors.text }]}>{t('friend_id')}</Text>
      <TextInput
        style={commonInputStyles.input}
        placeholder={t('enter_friend_id')}
        placeholderTextColor={colors.textSecondary}
        value={friendId}
        onChangeText={setFriendId}
        editable={!isEditingExisting} // Cannot edit friend ID when editing existing friendship
      />

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
        title={friendshipId ? t('save_changes') : t('add_friendship')}
        onPress={handleSaveFriendship}
        color={colors.primary}
      />
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
});

export default FriendshipFormScreen;
