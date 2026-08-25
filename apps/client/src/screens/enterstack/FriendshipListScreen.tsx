import Avatar from '@/src/components/common/display/Avatar/Avatar';
import { Ionicons } from '@expo/vector-icons';
import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../db';
import type { ServerSelect } from '../../db/schemas/servers'; // Import ServerSelect
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useFriendshipActionHandler } from '../../hooks/useFriendshipActionHandler';
import type { FriendshipStackParamList } from '../../navigation/StorySelectionStack';
import type { FriendshipWithServer } from '../../services/FriendshipService';
import { createFriendshipService } from '../../services/FriendshipService';
import { createServerService } from '../../services/ServerService'; // Import createServerService
import { useNotificationStore } from '../../state/notificationStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonCardStyles, getCommonContainerStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { useDocumentTitle } from '../../utils/documentTitle';

type FriendshipListScreenNavigationProp = NativeStackNavigationProp<
  FriendshipStackParamList,
  'FriendshipList'
>;

type FriendshipSection = {
  title: string;
  data: FriendshipWithServer[];
};

const FriendshipListScreen = () => {
  const navigation = useNavigation<FriendshipListScreenNavigationProp>();
  useBackButtonHandler();
  const { colors } = useTheme();
  const { t } = useTranslation();
  useDocumentTitle(t('manage_friendships'));
  const drizzleClient = useDrizzle();
  // Stable references: recreating these every render would change their identity, which sits
  // in fetchFriendshipsAndServers' dependency array and would re-subscribe/re-run on every render.
  const friendshipService = useRef(createFriendshipService(drizzleClient)).current;
  const serverService = useRef(createServerService(drizzleClient)).current;
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
      allServers.forEach((server) => newServersMap.set(server.id, server));
      setServersMap(newServersMap);
    } catch (error) {
      console.error('Error fetching servers:', error);
      AppAlert.alert(t('error'), t('failed_to_load_servers'));
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
      AppAlert.alert(t('error'), t('failed_to_load_friendships'));
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

  // `useCallback` para poder entrar nas dependências do efeito do cabeçalho abaixo: como
  // função solta, ela nasce de novo a cada render e faria o efeito rodar sempre.
  const handleAddFriendship = useCallback(() => {
    navigation.navigate('FriendshipForm');
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('manage_friendships'),
        headerRight: () => (
          <View style={{ flexDirection: 'row', marginRight: 15, gap: 15 }}>
            <TouchableOpacity
              onPress={handleAddFriendship}
              accessibilityLabel={t('add_new_friendship')}
            >
              <Ionicons name="add" size={30} color={colors.text} />
            </TouchableOpacity>
          </View>
        ),
      });
    }, [colors.text, handleAddFriendship, navigation, t]),
  );

  const runFriendshipAction = useFriendshipActionHandler(
    useCallback((serverId: string) => serversMap.get(serverId), [serversMap]),
    fetchFriendshipsAndServers,
  );

  const handleAcceptFriendRequest = runFriendshipAction(
    friendshipService.acceptFriendRequest.bind(friendshipService),
    t('accept_request_confirmation_title'),
    t('accept_request_confirmation_message'),
    t('request_accepted_successfully'),
    t('failed_to_accept_request'),
  );

  const handleDeclineFriendRequest = runFriendshipAction(
    friendshipService.declineFriendRequest.bind(friendshipService),
    t('decline_request_confirmation_title'),
    t('decline_request_confirmation_message'),
    t('request_declined_successfully'),
    t('failed_to_decline_request'),
  );

  const handleCancelSentFriendRequest = runFriendshipAction(
    friendshipService.cancelSentFriendRequest.bind(friendshipService),
    t('cancel_request_confirmation_title'),
    t('cancel_request_confirmation_message'),
    t('request_cancelled_successfully'),
    t('failed_to_cancel_request'),
  );

  const handleUnfriendUser = runFriendshipAction(
    friendshipService.unfriendUser.bind(friendshipService),
    t('unfriend_confirmation_title'),
    t('unfriend_confirmation_message'),
    t('unfriend_successful'),
    t('failed_to_unfriend'),
  );

  const handleBlacklistUser = runFriendshipAction(
    friendshipService.blacklistUser.bind(friendshipService),
    t('blacklist_confirmation_title'),
    t('blacklist_confirmation_message'),
    t('blacklist_successful'),
    t('failed_to_blacklist'),
  );

  const handleUnblacklistUser = runFriendshipAction(
    friendshipService.unblacklistUser.bind(friendshipService),
    t('unblacklist_confirmation_title'),
    t('unblacklist_confirmation_message'),
    t('unblacklist_successful'),
    t('failed_to_unblacklist'),
  );

  const sections = useMemo<FriendshipSection[]>(() => {
    const pending = friendships.filter((f) => f.status === FriendStatus.PENDING);
    const friends = friendships.filter((f) => f.status === FriendStatus.FRIEND);
    const blacklisted = friendships.filter((f) => f.status === FriendStatus.BLACKLISTED);
    return [
      { title: t('status_pending'), data: pending },
      { title: t('status_friend'), data: friends },
      { title: t('status_blacklisted'), data: blacklisted },
    ].filter((section) => section.data.length > 0);
  }, [friendships, t]);

  const renderFriendshipItem = ({ item }: { item: FriendshipWithServer }) => {
    const server = serversMap.get(item.serverId);
    const currentUsersServerId = server?.idUser;

    return (
      <TouchableOpacity
        style={[commonCardStyles.cardContainer, styles.friendshipItem]}
        onPress={() => navigation.navigate('FriendDetail', { friendshipId: item.id })}
      >
        <Avatar
          color={item.otherUserAvatarColor}
          icon={item.otherUserAvatarIcon}
          seed={item.otherUserId}
          size={44}
        />
        <View style={styles.friendshipInfo}>
          <Text style={[styles.friendshipText, { color: colors.text }]}>
            {item.status === FriendStatus.PENDING
              ? item.senderId === currentUsersServerId
                ? t('sent_to', { friendUsername: item.friendUsername })
                : t('received_from', { friendUsername: item.friendUsername })
              : item.friendUsername}
          </Text>
          <Text style={[styles.friendshipText, { color: colors.textSecondary }]}>
            {item.otherUserTag && `@${item.otherUserTag} · `}
            {t('server')}: {item.serverName || item.serverId}{' '}
            {item.serverUrl && `(${item.serverUrl})`}
          </Text>
        </View>
        <View style={styles.friendshipActions}>
          {item.status === FriendStatus.PENDING && item.receiverId === currentUsersServerId && (
            <>
              <TouchableOpacity
                onPress={() => handleAcceptFriendRequest(item.id, item.serverId)}
                style={styles.actionButton}
              >
                <Ionicons name="checkmark-circle-outline" size={24} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDeclineFriendRequest(item.id, item.serverId)}
                style={styles.actionButton}
              >
                <Ionicons name="close-circle-outline" size={24} color={colors.error} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleBlacklistUser(item.id, item.serverId)}
                style={styles.actionButton}
              >
                <Ionicons name="ban-outline" size={24} color={colors.accent} />
              </TouchableOpacity>
            </>
          )}

          {item.status === FriendStatus.PENDING && item.senderId === currentUsersServerId && (
            <TouchableOpacity
              onPress={() => handleCancelSentFriendRequest(item.id, item.serverId)}
              style={styles.actionButton}
            >
              <Ionicons name="close-circle-outline" size={24} color={colors.secondary} />
            </TouchableOpacity>
          )}

          {item.status === FriendStatus.FRIEND && (
            <>
              <TouchableOpacity
                onPress={() => handleUnfriendUser(item.id, item.serverId)}
                style={styles.actionButton}
              >
                <Ionicons name="person-remove-outline" size={24} color={colors.error} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleBlacklistUser(item.id, item.serverId)}
                style={styles.actionButton}
              >
                <Ionicons name="ban-outline" size={24} color={colors.accent} />
              </TouchableOpacity>
            </>
          )}

          {item.status === FriendStatus.BLACKLISTED &&
            // Only the side that issued the blacklist can undo it (server-enforced too, see
            // FriendshipService.unblacklistUser) - null `blockedById` is a legacy row from
            // before this column existed, shown to both sides since who blocked whom can't
            // be recovered for it.
            (item.blockedById === null || item.blockedById === currentUsersServerId) && (
              <TouchableOpacity
                onPress={() => handleUnblacklistUser(item.id, item.serverId)}
                style={styles.actionButton}
              >
                <Ionicons name="person-add-outline" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={commonContainerStyles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{t('your_friendships')}</Text>
      <SectionList
        sections={sections}
        renderItem={renderFriendshipItem}
        renderSectionHeader={({ section }) => (
          <Text
            style={[
              styles.sectionHeader,
              { color: colors.textSecondary, backgroundColor: colors.background },
            ]}
          >
            {section.title}
          </Text>
        )}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
            {t('no_friendships_found')}
          </Text>
        }
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
  sectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 5,
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
    marginLeft: 12,
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
});

export default FriendshipListScreen;
