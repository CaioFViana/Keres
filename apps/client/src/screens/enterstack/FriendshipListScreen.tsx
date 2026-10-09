import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { GuidedEmptyState } from '@/src/components/common/lists/GenericFilterSortList/ListEmptyStates';
import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import FriendshipRow from '../../components/features/friendship/FriendshipRow';
import OwnTagCard from '../../components/features/friendship/OwnTagCard';
import StoryInvitationList from '../../components/features/story/StoryInvitationList/StoryInvitationList';
import { useDrizzle } from '../../db';
import type { ServerSelect } from '../../db/schemas/servers';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useFriendshipActionHandler } from '../../hooks/useFriendshipActionHandler';
import type {
  FriendshipStackParamList,
  StorySelectionDrawerParamList,
} from '../../navigation/StorySelectionStack';
import type { FriendshipWithServer } from '../../services/FriendshipService';
import { createFriendshipService } from '../../services/FriendshipService';
import { createServerService } from '../../services/ServerService';
import { createStoryInvitationService } from '../../services/StoryInvitationService';
import { useNotificationStore } from '../../state/notificationStore';
import { useHasUnseenMessages } from '../../state/unseenMessagesStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter';

type FriendshipListScreenNavigationProp = NativeStackNavigationProp<
  FriendshipStackParamList,
  'FriendshipList'
>;

type FriendshipSection = {
  key: string;
  title: string;
  data: FriendshipWithServer[];
};

const FriendshipListScreen = () => {
  const navigation = useNavigation<FriendshipListScreenNavigationProp>();
  useBackButtonHandler();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const drizzleClient = useDrizzle();
  // Stable references: recreating these every render would change their identity, which sits
  // in fetchFriendshipsAndServers' dependency array and would re-subscribe/re-run on every render.
  const [friendshipService] = useState(() => createFriendshipService(drizzleClient));
  const [serverService] = useState(() => createServerService(drizzleClient));
  const { userId: localUserId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();

  const [friendships, setFriendships] = useState<FriendshipWithServer[]>([]);
  const [servers, setServers] = useState<ServerSelect[]>([]);
  const [loaded, setLoaded] = useState(false);
  const serversMap = useMemo(
    () => new Map(servers.map((server) => [server.id, server])),
    [servers],
  );

  const commonContainerStyles = getCommonContainerStyles(colors);

  const loadFriendshipsAndServers = useCallback(async () => {
    try {
      const allServers = await serverService.getAllServers();
      setServers(allServers);
      // Invitations are not kept locally: opening the screen asks every server for the open ones.
      const invitationService = createStoryInvitationService(drizzleClient);
      for (const server of allServers) {
        invitationService
          .syncWithServer(server)
          .catch((error) => console.log('Story invitation sync failed:', error));
      }
    } catch (error) {
      console.error('Error fetching servers:', error);
      AppAlert.alert(t('error'), t('failed_to_load_servers'));
      return;
    }

    if (!localUserId) {
      showNotification(t('not_logged_in'), 'error');
      setFriendships([]);
      return;
    }
    try {
      setFriendships(await friendshipService.getAllFriendships());
    } catch (error) {
      console.error('Error fetching friendships:', error);
      AppAlert.alert(t('error'), t('failed_to_load_friendships'));
    }
  }, [drizzleClient, friendshipService, serverService, showNotification, t, localUserId]);

  // The empty state waits for the first load: before it, "no servers" and "no friends" are only guesses.
  const fetchFriendshipsAndServers = useCallback(async () => {
    try {
      await loadFriendshipsAndServers();
    } finally {
      setLoaded(true);
    }
  }, [loadFriendshipsAndServers]);

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

  // `useCallback` so it can go into the header effect's dependencies below: as a loose function it is
  // born anew on every render and would make the effect run every time.
  const handleAddFriendship = useCallback(() => {
    navigation.navigate('FriendshipForm');
  }, [navigation]);

  const handleRegisterServer = useCallback(() => {
    navigation
      .getParent<DrawerNavigationProp<StorySelectionDrawerParamList>>()
      ?.navigate('ServerManagementDrawer', { screen: 'ServerManagement' });
  }, [navigation]);

  const hasUnseenMessages = useHasUnseenMessages();
  const handleOpenInbox = useCallback(() => {
    navigation.navigate('MessageInbox');
  }, [navigation]);

  useScreenHeader({
    target: 'parent',
    title: t('manage_friendships'),
    actions: [
      { id: 'action-0', icon: 'add', label: t('add_new_friendship'), onPress: handleAddFriendship },
      {
        id: 'inbox',
        // The inbox icon says when something is waiting in it.
        icon: hasUnseenMessages ? 'mail-unread-outline' : 'chatbubbles-outline',
        label: hasUnseenMessages ? t('messages_unseen') : t('messages_title'),
        onPress: handleOpenInbox,
      },
    ],
  });

  const runFriendshipAction = useFriendshipActionHandler(
    useCallback((serverId: string) => serversMap.get(serverId), [serversMap]),
    fetchFriendshipsAndServers,
  );

  // Answering, withdrawing and unblocking are harmless to do by mistake and go through at once;
  // removing a friend and blocking ask first.
  const handleAcceptFriendRequest = runFriendshipAction(
    friendshipService.acceptFriendRequest.bind(friendshipService),
    t('accept_request_confirmation_title'),
    t('accept_request_confirmation_message'),
    t('request_accepted_successfully'),
    t('failed_to_accept_request'),
    { confirm: false },
  );

  const handleDeclineFriendRequest = runFriendshipAction(
    friendshipService.declineFriendRequest.bind(friendshipService),
    t('decline_request_confirmation_title'),
    t('decline_request_confirmation_message'),
    t('request_declined_successfully'),
    t('failed_to_decline_request'),
    { confirm: false },
  );

  const handleCancelSentFriendRequest = runFriendshipAction(
    friendshipService.cancelSentFriendRequest.bind(friendshipService),
    t('cancel_request_confirmation_title'),
    t('cancel_request_confirmation_message'),
    t('request_cancelled_successfully'),
    t('failed_to_cancel_request'),
    { confirm: false },
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
    { confirm: false },
  );

  const sections = useMemo<FriendshipSection[]>(() => {
    const isReceived = (f: FriendshipWithServer) =>
      f.status === FriendStatus.PENDING && f.receiverId === serversMap.get(f.serverId)?.idUser;
    const pending = friendships.filter((f) => f.status === FriendStatus.PENDING);
    const received = pending.filter(isReceived);
    const sent = pending.filter((f) => !isReceived(f));
    const friends = friendships.filter((f) => f.status === FriendStatus.FRIEND);
    const blocked = friendships.filter((f) => f.status === FriendStatus.BLACKLISTED);
    return [
      { key: 'received', title: t('friend_requests_received'), data: received },
      { key: 'sent', title: t('friend_requests_sent'), data: sent },
      { key: 'friends', title: t('friends_title'), data: friends },
      { key: 'blocked', title: t('friends_blocked_title'), data: blocked },
    ].filter((section) => section.data.length > 0);
  }, [friendships, serversMap, t]);

  // A server is only worth naming on a row when there is another to tell it from.
  const showServer = servers.length > 1;

  const renderFriendshipItem = ({ item }: { item: FriendshipWithServer }) => (
    <FriendshipRow
      item={item}
      currentUsersServerId={serversMap.get(item.serverId)?.idUser}
      showServer={showServer}
      onOpen={() => navigation.navigate('FriendDetail', { friendshipId: item.id })}
      onChat={() =>
        navigation.navigate('Conversation', {
          serverId: item.serverId,
          peer: item.otherUserId,
          peerName: item.friendUsername,
        })
      }
      onAccept={() => handleAcceptFriendRequest(item.id, item.serverId)}
      onDecline={() => handleDeclineFriendRequest(item.id, item.serverId)}
      onCancel={() => handleCancelSentFriendRequest(item.id, item.serverId)}
      onUnfriend={() => handleUnfriendUser(item.id, item.serverId)}
      onBlock={() => handleBlacklistUser(item.id, item.serverId)}
      onUnblock={() => handleUnblacklistUser(item.id, item.serverId)}
    />
  );

  return (
    <View style={commonContainerStyles.container}>
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
            {`${section.title} · ${section.data.length}`}
          </Text>
        )}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <>
            <OwnTagCard servers={servers} />
            <StoryInvitationList serverFor={(id) => serversMap.get(id)} />
          </>
        }
        ListEmptyComponent={
          loaded ? (
            <GuidedEmptyState
              icon="people-outline"
              title={t('friends_empty_title')}
              message={
                servers.length > 0
                  ? t('friends_empty_message')
                  : t('friends_empty_no_server_message')
              }
              actions={
                servers.length > 0
                  ? [
                      {
                        label: t('friends_empty_add'),
                        onPress: handleAddFriendship,
                        testID: 'friends-empty-add',
                      },
                    ]
                  : [
                      {
                        label: t('friends_empty_register_server'),
                        onPress: handleRegisterServer,
                        testID: 'friends-empty-register',
                      },
                    ]
              }
              fallbackText={t('no_friendships_found')}
            />
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 8,
  },
});

export default FriendshipListScreen;
