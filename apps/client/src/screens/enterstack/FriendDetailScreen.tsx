import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import FriendConversationCard from '../../components/features/friendship/FriendConversationCard';
import FriendDetailActions, {
  type FriendDetailMode,
} from '../../components/features/friendship/FriendDetailActions';
import FriendInvitationsBetween from '../../components/features/friendship/FriendInvitationsBetween';
import FriendProfileHeader from '../../components/features/friendship/FriendProfileHeader';
import FriendSharedStories from '../../components/features/friendship/FriendSharedStories';
import InviteToStoryModal from '../../components/features/friendship/InviteToStoryModal';
import { useDrizzle } from '../../db';
import type { ServerSelect } from '../../db/schemas/servers';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityInitialLoad } from '../../hooks/useEntityRefreshLifecycle';
import { useFriendActivity } from '../../hooks/useFriendActivity';
import { useFriendshipActionHandler } from '../../hooks/useFriendshipActionHandler';
import { useInviteFriendToStory } from '../../hooks/useInviteFriendToStory';
import { useOpenStoryById } from '../../hooks/useOpenStoryById';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useStoryInvitationList } from '../../hooks/useStoryInvitationList';
import type { FriendshipStackParamList } from '../../navigation/StorySelectionStack';
import type { FriendshipWithServer } from '../../services/FriendshipService';
import { createFriendshipService } from '../../services/FriendshipService';
import { createServerService } from '../../services/ServerService';
import { useNotificationStore } from '../../state/notificationStore';
import { useIsConversationUnseen } from '../../state/unseenMessagesStore';
import { type ThemeColors } from '../../theme';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { directConversationKey } from '../../utils/conversationKey';
import { entityEventEmitter } from '../../utils/EventEmitter';

type FriendDetailScreenRouteProp = RouteProp<FriendshipStackParamList, 'FriendDetail'>;
type FriendDetailScreenNavigationProp = NativeStackNavigationProp<
  FriendshipStackParamList,
  'FriendDetail'
>;

const FriendDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { isCompact } = useResponsiveLayout();
  const navigation = useNavigation<FriendDetailScreenNavigationProp>();
  const route = useRoute<FriendDetailScreenRouteProp>();
  const { friendshipId } = route.params;
  const drizzleClient = useDrizzle();
  // Stable references: recreating these every render would change `load`'s identity (it
  // depends on both), and `load` runs unconditionally inside the effect below - an unstable
  // dependency there is an infinite render loop, not just wasted work.
  const [friendshipService] = useState(() => createFriendshipService(drizzleClient));
  const [serverService] = useState(() => createServerService(drizzleClient));
  const { showNotification } = useNotificationStore();

  const [friendship, setFriendship] = useState<FriendshipWithServer | null>(null);
  const [server, setServer] = useState<ServerSelect | null>(null);
  const [alsoOn, setAlsoOn] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);

  // Messages are for friends only (the API refuses anybody else), so the way in only shows for them.
  const openConversation = useCallback(() => {
    if (!friendship) return;
    navigation.navigate('Conversation', {
      serverId: friendship.serverId,
      peer: friendship.otherUserId,
      peerName: friendship.friendUsername,
    });
  }, [friendship, navigation]);
  const hasUnseenMessage = useIsConversationUnseen(
    friendship ? directConversationKey(friendship.serverId, friendship.otherUserId) : '',
  );
  useScreenHeader({
    target: 'parent',
    title: t('friend_detail_title'),
    actions: [
      {
        id: 'send-message',
        // A friend who wrote something unopened shows in the header too, so the way in says there is news.
        icon: hasUnseenMessage ? 'chatbubble-ellipses' : 'chatbubble-outline',
        label: hasUnseenMessage
          ? t('messages_unseen_from', { name: friendship?.friendUsername })
          : t('send_message'),
        onPress: openConversation,
        visible: friendship?.status === FriendStatus.FRIEND,
        badge: hasUnseenMessage,
      },
    ],
  });

  // `load` is wired to three independent triggers below (mount, the `focus` listener, and
  // the `friendship_changed` event), so a single action that deletes this friendship (e.g.
  // unblacklisting) can fire `load` more than once while the screen is still mounted. Every
  // one of those calls would find `found === null` and call `goBack()` - the first pops the
  // screen correctly, but every call after that has nothing left to pop and no navigator to
  // bubble to, crashing with "GO_BACK was not handled by any navigator". This ref makes the
  // "not found, navigate away" branch run at most once per screen instance.
  const hasNavigatedAwayRef = useRef(false);

  const load = useCallback(async () => {
    if (hasNavigatedAwayRef.current) {
      return;
    }
    try {
      const [allFriendships, allServers] = await Promise.all([
        friendshipService.getAllFriendships(),
        serverService.getAllServers(),
      ]);
      const found = allFriendships.find((f) => f.id === friendshipId) ?? null;
      if (!found) {
        // Friendship no longer exists (e.g. removed from another device mid-sync) - nothing left to show here.
        hasNavigatedAwayRef.current = true;
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
        return;
      }
      setFriendship(found);
      setServer(allServers.find((s) => s.id === found.serverId) ?? null);
      // The same @tag on another server is somebody else: say so, so the two are not taken for one.
      const tag = found.otherUserTag?.toLowerCase();
      setAlsoOn(
        tag
          ? allFriendships
              .filter(
                (other) =>
                  other.id !== found.id &&
                  other.serverId !== found.serverId &&
                  other.otherUserTag?.toLowerCase() === tag,
              )
              .map((other) => other.serverName || other.serverId)
          : [],
      );
    } catch (err) {
      console.error('Failed to load friend detail:', err);
      showNotification(t('failed_to_load_friendships'), 'error');
    } finally {
      setLoading(false);
    }
  }, [friendshipService, serverService, friendshipId, navigation, showNotification, t]);

  useEntityInitialLoad(load);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', load);
    entityEventEmitter.on('friendship_changed', load);
    return () => {
      unsubscribeFocus();
      entityEventEmitter.off('friendship_changed', load);
    };
  }, [load, navigation]);

  const runFriendshipAction = useFriendshipActionHandler(
    useCallback(() => server ?? undefined, [server]),
    load,
  );

  // Answering, withdrawing and unblocking are harmless to do by mistake and go through at once;
  // removing a friend and blocking ask first.
  const handleAccept = runFriendshipAction(
    friendshipService.acceptFriendRequest.bind(friendshipService),
    t('accept_request_confirmation_title'),
    t('accept_request_confirmation_message'),
    t('request_accepted_successfully'),
    t('failed_to_accept_request'),
    { confirm: false },
  );
  const handleDecline = runFriendshipAction(
    friendshipService.declineFriendRequest.bind(friendshipService),
    t('decline_request_confirmation_title'),
    t('decline_request_confirmation_message'),
    t('request_declined_successfully'),
    t('failed_to_decline_request'),
    { confirm: false },
  );
  const handleCancel = runFriendshipAction(
    friendshipService.cancelSentFriendRequest.bind(friendshipService),
    t('cancel_request_confirmation_title'),
    t('cancel_request_confirmation_message'),
    t('request_cancelled_successfully'),
    t('failed_to_cancel_request'),
    { confirm: false },
  );
  const handleUnfriend = runFriendshipAction(
    friendshipService.unfriendUser.bind(friendshipService),
    t('unfriend_confirmation_title'),
    t('unfriend_confirmation_message'),
    t('unfriend_successful'),
    t('failed_to_unfriend'),
  );
  const handleBlacklist = runFriendshipAction(
    friendshipService.blacklistUser.bind(friendshipService),
    t('blacklist_confirmation_title'),
    t('blacklist_confirmation_message'),
    t('blacklist_successful'),
    t('failed_to_blacklist'),
  );
  const handleUnblacklist = runFriendshipAction(
    friendshipService.unblacklistUser.bind(friendshipService),
    t('unblacklist_confirmation_title'),
    t('unblacklist_confirmation_message'),
    t('unblacklist_successful'),
    t('failed_to_unblacklist'),
    { confirm: false },
  );

  const currentUsersServerId = server?.idUser;
  const isPendingReceived =
    friendship?.status === FriendStatus.PENDING && friendship.receiverId === currentUsersServerId;
  const isPendingSent =
    friendship?.status === FriendStatus.PENDING && friendship.senderId === currentUsersServerId;
  const isFriend = friendship?.status === FriendStatus.FRIEND;
  const isBlacklisted = friendship?.status === FriendStatus.BLACKLISTED;
  // Only whoever issued the blacklist can undo it - the server enforces this too (see
  // FriendshipService.unblacklistUser on the API), this just keeps the button from being
  // offered to the blocked side in the first place. Legacy rows with no recorded blocker
  // (`blockedById: null`) are shown to both sides, matching the server's permissive fallback
  // for data that predates this column - there's no way to recover who actually blocked whom.
  const isBlockedByMe =
    isBlacklisted &&
    (friendship?.blockedById === null || friendship?.blockedById === currentUsersServerId);

  // What the friend and the person have going on, read from their server: only for a friend.
  const activity = useFriendActivity(
    server,
    friendship?.otherUserId ?? null,
    !!isFriend,
    friendship,
  );

  // The invitations still open between the two, in both directions (they live in the app's invitation list).
  const invitations = useStoryInvitationList(
    useCallback((id: string) => (server && server.id === id ? server : undefined), [server]),
  );
  const between = useMemo(() => {
    if (!friendship) return { received: [], sent: [] };
    const mine = (invitation: { serverId: string }) => invitation.serverId === friendship.serverId;
    return {
      received: invitations.received.filter(
        (invitation) => mine(invitation) && invitation.inviterId === friendship.otherUserId,
      ),
      sent: invitations.sent.filter(
        (invitation) => mine(invitation) && invitation.inviteeId === friendship.otherUserId,
      ),
    };
  }, [friendship, invitations.received, invitations.sent]);
  // Stories that need no invitation: already worked on together, or already offered.
  const noInviteNeeded = useMemo(
    () => [
      ...(activity.sharedStories ?? []).filter((story) => story.ownedByMe).map((s) => s.storyId),
      ...between.sent.map((invitation) => invitation.storyId),
    ],
    [activity.sharedStories, between.sent],
  );

  const openStory = useOpenStoryById();
  const closeInvite = useCallback(() => setInviting(false), []);
  const invite = useInviteFriendToStory({
    open: inviting,
    server,
    friendId: friendship?.otherUserId ?? null,
    excludeStoryIds: noInviteNeeded,
    onInvited: closeInvite,
  });

  const styles = useThemedStyles(createStyles);

  if (loading) {
    return <ScreenLoading message={t('loading')} />;
  }

  if (!friendship) {
    return <ScreenError message={t('friendship_not_found')} onGoBack={() => navigation.goBack()} />;
  }

  const mode: FriendDetailMode = isPendingReceived
    ? 'received'
    : isPendingSent
      ? 'sent'
      : isFriend
        ? 'friend'
        : isBlockedByMe
          ? 'blocked-by-me'
          : 'blocked-by-them';

  const sharedStories = isFriend ? (
    <FriendSharedStories
      friendName={friendship.friendUsername}
      stories={activity.sharedStories}
      loading={activity.loading}
      failed={activity.sharedStoriesFailed}
      canInvite={!!server}
      onOpenStory={(storyId) => void openStory(storyId)}
      onInvite={() => setInviting(true)}
    />
  ) : null;
  const invitationsBetween = (
    <FriendInvitationsBetween
      received={between.received}
      sent={between.sent}
      busyId={invitations.busyId}
      onAccept={invitations.accept}
      onDecline={invitations.decline}
      onWithdraw={invitations.withdraw}
    />
  );
  const conversation = activity.lastMessage ? (
    <FriendConversationCard
      message={activity.lastMessage}
      unseen={hasUnseenMessage}
      onPress={openConversation}
    />
  ) : null;
  const hasInvitations = between.received.length + between.sent.length > 0;

  return (
    <DetailContainer>
      <FriendProfileHeader friendship={friendship} alsoOn={alsoOn} />

      {friendship.otherUserBio ? <Text style={styles.bio}>{friendship.otherUserBio}</Text> : null}

      <FriendDetailActions
        mode={mode}
        compact={isCompact}
        friendName={friendship.friendUsername}
        hasConversation={!!activity.lastMessage}
        onMessage={openConversation}
        onInvite={() => setInviting(true)}
        onAccept={() => handleAccept(friendship.id, friendship.serverId)}
        onDecline={() => handleDecline(friendship.id, friendship.serverId)}
        onCancel={() => handleCancel(friendship.id, friendship.serverId)}
        onUnblock={() => handleUnblacklist(friendship.id, friendship.serverId)}
        onUnfriend={() => handleUnfriend(friendship.id, friendship.serverId)}
        onBlock={() => handleBlacklist(friendship.id, friendship.serverId)}
      />

      {mode === 'blocked-by-them' && (
        <Text style={styles.blockedNote}>{t('blocked_by_other_user')}</Text>
      )}

      {(isFriend || hasInvitations) && (
        <View style={[styles.sections, !isCompact && styles.columns]}>
          <View style={[styles.column, !isCompact && styles.columnShare]}>
            {hasInvitations && invitationsBetween}
            {sharedStories}
          </View>
          {conversation && (
            <View style={[styles.column, !isCompact && styles.columnShare]}>{conversation}</View>
          )}
        </View>
      )}

      {server && (
        <InviteToStoryModal
          visible={inviting}
          onClose={closeInvite}
          friendName={friendship.friendUsername}
          serverName={server.name}
          stories={invite.stories}
          busy={invite.busy}
          onInvite={invite.invite}
        />
      )}
    </DetailContainer>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bio: { fontSize: 15, color: colors.text, lineHeight: 21, marginTop: 16 },
    blockedNote: { fontSize: 13, color: colors.textSecondary, marginTop: 20 },
    sections: { marginTop: 28, gap: 28 },
    columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 32 },
    column: { minWidth: 0, gap: 28 },
    // Only side by side do the columns share the width: stacked, `flex: 1` has no height to share.
    columnShare: { flex: 1 },
  });

export default FriendDetailScreen;
