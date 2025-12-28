import { Ionicons } from '@expo/vector-icons';
import { StackActions, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../db';
import { createFriendshipService, FriendshipWithServer } from '../../services/FriendshipService';
import { createServerService } from '../../services/ServerService'; // Import createServerService
import { ServerSelect } from '../../db/schemas/servers'; // Import ServerSelect
import { useNotificationStore } from '../../state/notificationStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonCardStyles, getCommonContainerStyles } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { FriendStatus } from '@keres/shared/metadata/FriendStatus';

type FriendshipStackParamList = {
  FriendshipList: undefined;
  FriendshipForm: { friendshipId?: string };
};

type FriendshipListScreenNavigationProp = NativeStackNavigationProp<FriendshipStackParamList, 'FriendshipList'>;

const FriendshipListScreen = () => {
  const navigation = useNavigation<FriendshipListScreenNavigationProp>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const drizzleClient = useDrizzle();
  const friendshipService = createFriendshipService(drizzleClient);
  const serverService = createServerService(drizzleClient); // Initialize ServerService
  const { userId: localUserId } = useUserSettingsStore(); // Renamed userId to localUserId
  const { showNotification } = useNotificationStore();

  const [friendships, setFriendships] = useState<FriendshipWithServer[]>([]);
  const [serversMap, setServersMap] = useState<Map<string, ServerSelect>>(new Map()); // State to store servers map

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonCardStyles = getCommonCardStyles(colors);

  const fetchFriendshipsAndServers = useCallback(async () => {
    // Fetch all servers first
    try {
      const allServers = await serverService.getAllServers();
      const newServersMap = new Map<string, ServerSelect>();
      allServers.forEach(server => newServersMap.set(server.id, server));
      setServersMap(newServersMap);
    } catch (error) {
      console.error('Error fetching servers:', error);
      Alert.alert(t('error'), t('failed_to_load_servers'));
      return;
    }

    // Now fetch friendships
    if (!localUserId) {
      showNotification(t('not_logged_in'), 'error'); // Use general not_logged_in
      setFriendships([]);
      return;
    }
    try {
      const allFetched = await friendshipService.getAllFriendships();
      setFriendships(allFetched);
    } catch (error) {
      console.error('Error fetching friendships:', error);
      Alert.alert(t('error'), t('failed_to_load_friendships'));
    }
  }, [friendshipService, serverService, showNotification, t, localUserId]);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      fetchFriendshipsAndServers();
    });
    entityEventEmitter.on('friendship_changed', fetchFriendshipsAndServers);

    return () => {
      unsubscribeFocus();
      entityEventEmitter.off('friendship_changed', fetchFriendshipsAndServers);
    };
  }, [fetchFriendshipsAndServers, navigation]);

  useEffect(() => {
    const handleReset = () => {
      if (navigation.getState().routes.length > 1) {
        navigation.dispatch(StackActions.popToTop());
      }
    };
    entityEventEmitter.on('friendship_navigation_reset', handleReset);
    return () => {
      entityEventEmitter.off('friendship_navigation_reset', handleReset);
    };
  }, [navigation]);

  const handleAddFriendship = () => {
    navigation.navigate('FriendshipForm', {});
  };

  const createActionHandler = useCallback((
    action: (id: string, userId: string) => Promise<void>,
    confirmationTitle: string,
    confirmationMessage: string,
    successMessage: string,
    errorMessage: string
  ) => async (friendshipId: string) => {
    Alert.alert(
      confirmationTitle,
      confirmationMessage,
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('proceed'),
          onPress: async () => {
            try {
              const friendship = friendships.find(f => f.id === friendshipId);
              if (!friendship) {
                showNotification(t('friendship_not_found'), 'error');
                return;
              }
              const server = serversMap.get(friendship.serverId);
              const currentUsersServerId = server?.idUser; // Get the user ID on that specific server

              if (!currentUsersServerId) {
                showNotification(t('not_logged_in_to_server'), 'error');
                return;
              }
              await action(friendshipId, currentUsersServerId); // Pass the correct server-specific user ID
              showNotification(successMessage, 'success');
              fetchFriendshipsAndServers();
            } catch (error) {
              console.error(`Error during action (ID: ${friendshipId}):`, error);
              showNotification(errorMessage, 'error');
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [friendships, serversMap, showNotification, fetchFriendshipsAndServers, t]);

  const handleAcceptFriendRequest = createActionHandler(
    friendshipService.acceptFriendRequest.bind(friendshipService),
    t('accept_request_confirmation_title'),
    t('accept_request_confirmation_message'),
    t('request_accepted_successfully'),
    t('failed_to_accept_request')
  );

  const handleDeclineFriendRequest = createActionHandler(
    friendshipService.declineFriendRequest.bind(friendshipService),
    t('decline_request_confirmation_title'),
    t('decline_request_confirmation_message'),
    t('request_declined_successfully'),
    t('failed_to_decline_request')
  );

  const handleCancelSentFriendRequest = createActionHandler(
    friendshipService.cancelSentFriendRequest.bind(friendshipService),
    t('cancel_request_confirmation_title'),
    t('cancel_request_confirmation_message'),
    t('request_cancelled_successfully'),
    t('failed_to_cancel_request')
  );

  const handleUnfriendUser = createActionHandler(
    friendshipService.unfriendUser.bind(friendshipService),
    t('unfriend_confirmation_title'),
    t('unfriend_confirmation_message'),
    t('unfriend_successful'),
    t('failed_to_unfriend')
  );

  const handleBlacklistUser = createActionHandler(
    friendshipService.blacklistUser.bind(friendshipService),
    t('blacklist_confirmation_title'),
    t('blacklist_confirmation_message'),
    t('blacklist_successful'),
    t('failed_to_blacklist')
  );

  const handleUnblacklistUser = createActionHandler(
    friendshipService.unblacklistUser.bind(friendshipService),
    t('unblacklist_confirmation_title'),
    t('unblacklist_confirmation_message'),
    t('unblacklist_successful'),
    t('failed_to_unblacklist')
  );

  const renderFriendshipItem = ({ item }: { item: FriendshipWithServer }) => {
    const server = serversMap.get(item.serverId);
    const currentUsersServerId = server?.idUser;

    return (
      <View style={[commonCardStyles.cardContainer, styles.friendshipItem]}>
        <View style={styles.friendshipInfo}>
          <Text style={[styles.friendshipText, { color: colors.text }]}>
            {item.senderId === currentUsersServerId
              ? t('sent_to', { friendUsername: item.friendUsername })
              : t('received_from', { friendUsername: item.friendUsername })
            }
          </Text>
          <Text style={[styles.friendshipText, { color: colors.textSecondary }]}>
            {t('server')}: {item.serverName || item.serverId} {item.serverUrl && `(${item.serverUrl})`}
          </Text>
          <Text style={[styles.friendshipText, { color: colors.textSecondary }]}>
            {t('status')}: {item.status === FriendStatus.PENDING
              ? t('status_pending')
              : item.status === FriendStatus.FRIEND
                ? t('status_friend')
                : item.status === FriendStatus.BLACKLISTED
                  ? t('status_blacklisted')
                  : t('status_common_friend')
            }
          </Text>
        </View>
        <View style={styles.friendshipActions}>
          {item.status === FriendStatus.PENDING && item.receiverId === currentUsersServerId && (
            <>
              <TouchableOpacity onPress={() => handleAcceptFriendRequest(item.id)} style={styles.actionButton}>
                <Ionicons name="checkmark-circle-outline" size={24} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeclineFriendRequest(item.id)} style={styles.actionButton}>
                <Ionicons name="close-circle-outline" size={24} color={colors.error} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleBlacklistUser(item.id)} style={styles.actionButton}>
                <Ionicons name="ban-outline" size={24} color={colors.accent} />
              </TouchableOpacity>
            </>
          )}

          {item.status === FriendStatus.PENDING && item.senderId === currentUsersServerId && (
            <TouchableOpacity onPress={() => handleCancelSentFriendRequest(item.id)} style={styles.actionButton}>
              <Ionicons name="close-circle-outline" size={24} color={colors.secondary} />
            </TouchableOpacity>
          )}

          {item.status === FriendStatus.FRIEND && (
            <>
              <TouchableOpacity onPress={() => handleUnfriendUser(item.id)} style={styles.actionButton}>
                <Ionicons name="person-remove-outline" size={24} color={colors.error} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleBlacklistUser(item.id)} style={styles.actionButton}>
                <Ionicons name="ban-outline" size={24} color={colors.accent} />
              </TouchableOpacity>
            </>
          )}

          {item.status === FriendStatus.BLACKLISTED && (
            <TouchableOpacity onPress={() => handleUnblacklistUser(item.id)} style={styles.actionButton}>
              <Ionicons name="person-add-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={commonContainerStyles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{t('your_friendships')}</Text>
      <FlatList
        data={friendships}
        renderItem={renderFriendshipItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
            {t('no_friendships_found')}
          </Text>
        }
      />
      <TouchableOpacity
        style={[styles.floatingButton, { backgroundColor: colors.primary }]}
        onPress={() => handleAddFriendship()}
      >
        <Ionicons name="add-outline" size={30} color={colors.onPrimary} />
      </TouchableOpacity>
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
  friendshipItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    padding: 15,
  },
  friendshipInfo: {
    flex: 1,
  },
  friendshipText: {
    fontSize: 16,
    marginBottom: 2,
  },
  friendshipActions: {
    flexDirection: 'row',
    marginLeft: 10,
  },
  actionButton: {
    padding: 8,
    marginLeft: 5,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#6200EE',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

export default FriendshipListScreen;