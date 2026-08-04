import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Avatar from '../../components/common/Avatar/Avatar';
import Button from '../../components/common/Button/Button';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import { useDrizzle } from '../../db';
import { ServerSelect } from '../../db/schemas/servers';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useFriendshipActionHandler } from '../../hooks/useFriendshipActionHandler';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { FriendshipStackParamList } from '../../navigation/StorySelectionStack';
import { createFriendshipService, FriendshipWithServer } from '../../services/FriendshipService';
import { createServerService } from '../../services/ServerService';
import { useNotificationStore } from '../../state/notificationStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter';

type FriendDetailScreenRouteProp = RouteProp<FriendshipStackParamList, 'FriendDetail'>;
type FriendDetailScreenNavigationProp = NativeStackNavigationProp<FriendshipStackParamList, 'FriendDetail'>;

const statusLabelKey = (status: string) => {
  switch (status) {
    case FriendStatus.PENDING: return 'status_pending';
    case FriendStatus.FRIEND: return 'status_friend';
    default: return 'status_blacklisted';
  }
};

const FriendDetailScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<FriendDetailScreenNavigationProp>();
  const route = useRoute<FriendDetailScreenRouteProp>();
  const { friendshipId } = route.params;
  const drizzleClient = useDrizzle();
  const friendshipService = createFriendshipService(drizzleClient);
  const serverService = createServerService(drizzleClient);
  const { showNotification } = useNotificationStore();
  const commonContainerStyles = getCommonContainerStyles(colors);
  const scrollBottomPadding = useFormScrollBottomPadding();

  const [friendship, setFriendship] = useState<FriendshipWithServer | null>(null);
  const [server, setServer] = useState<ServerSelect | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [allFriendships, allServers] = await Promise.all([
        friendshipService.getAllFriendships(),
        serverService.getAllServers(),
      ]);
      const found = allFriendships.find((f) => f.id === friendshipId) ?? null;
      if (!found) {
        // Friendship no longer exists (e.g. removed from another device mid-sync) - nothing left to show here.
        navigation.goBack();
        return;
      }
      setFriendship(found);
      setServer(allServers.find((s) => s.id === found.serverId) ?? null);
    } catch (err) {
      console.error('Failed to load friend detail:', err);
      showNotification(t('failed_to_load_friendships'), 'error');
    } finally {
      setLoading(false);
    }
  }, [friendshipService, serverService, friendshipId, navigation, showNotification, t]);

  useEffect(() => {
    load();
    const unsubscribeFocus = navigation.addListener('focus', load);
    entityEventEmitter.on('friendship_changed', load);
    return () => {
      unsubscribeFocus();
      entityEventEmitter.off('friendship_changed', load);
    };
  }, [load, navigation]);

  const runFriendshipAction = useFriendshipActionHandler(
    useCallback(() => server ?? undefined, [server]),
    load
  );

  const handleAccept = runFriendshipAction(
    friendshipService.acceptFriendRequest.bind(friendshipService),
    t('accept_request_confirmation_title'),
    t('accept_request_confirmation_message'),
    t('request_accepted_successfully'),
    t('failed_to_accept_request')
  );
  const handleDecline = runFriendshipAction(
    friendshipService.declineFriendRequest.bind(friendshipService),
    t('decline_request_confirmation_title'),
    t('decline_request_confirmation_message'),
    t('request_declined_successfully'),
    t('failed_to_decline_request')
  );
  const handleCancel = runFriendshipAction(
    friendshipService.cancelSentFriendRequest.bind(friendshipService),
    t('cancel_request_confirmation_title'),
    t('cancel_request_confirmation_message'),
    t('request_cancelled_successfully'),
    t('failed_to_cancel_request')
  );
  const handleUnfriend = runFriendshipAction(
    friendshipService.unfriendUser.bind(friendshipService),
    t('unfriend_confirmation_title'),
    t('unfriend_confirmation_message'),
    t('unfriend_successful'),
    t('failed_to_unfriend')
  );
  const handleBlacklist = runFriendshipAction(
    friendshipService.blacklistUser.bind(friendshipService),
    t('blacklist_confirmation_title'),
    t('blacklist_confirmation_message'),
    t('blacklist_successful'),
    t('failed_to_blacklist')
  );
  const handleUnblacklist = runFriendshipAction(
    friendshipService.unblacklistUser.bind(friendshipService),
    t('unblacklist_confirmation_title'),
    t('unblacklist_confirmation_message'),
    t('unblacklist_successful'),
    t('failed_to_unblacklist')
  );

  const styles = StyleSheet.create({
    scrollViewContent: { padding: 20, paddingBottom: scrollBottomPadding, flexGrow: 1 },
    avatarContainer: { alignItems: 'center', marginBottom: 15 },
    username: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: colors.text },
    statusBadge: { fontSize: 14, textAlign: 'center', color: colors.textSecondary, marginTop: 4, marginBottom: 20 },
    label: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 5, color: colors.text },
    bio: { fontSize: 15, color: colors.text, lineHeight: 21 },
    serverInfo: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
    actionsContainer: { marginTop: 35 },
    actionButton: { marginTop: 10 },
    destructiveButton: { backgroundColor: colors.error },
  });

  if (loading) {
    return <ScreenLoading message={t('loading')} />;
  }

  if (!friendship) {
    return <ScreenError message={t('friendship_not_found')} onGoBack={() => navigation.goBack()} />;
  }

  const currentUsersServerId = server?.idUser;
  const isPendingReceived = friendship.status === FriendStatus.PENDING && friendship.receiverId === currentUsersServerId;
  const isPendingSent = friendship.status === FriendStatus.PENDING && friendship.senderId === currentUsersServerId;
  const isFriend = friendship.status === FriendStatus.FRIEND;
  const isBlacklisted = friendship.status === FriendStatus.BLACKLISTED;

  return (
    <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
      <View style={styles.avatarContainer}>
        <Avatar
          color={friendship.otherUserAvatarColor}
          icon={friendship.otherUserAvatarIcon}
          seed={friendship.otherUserId}
          size={96}
        />
      </View>
      <Text style={styles.username}>{friendship.friendUsername}</Text>
      <Text style={styles.statusBadge}>{t(statusLabelKey(friendship.status))}</Text>
      <Text style={styles.serverInfo}>
        {friendship.otherUserTag && `@${friendship.otherUserTag} · `}{friendship.serverName || friendship.serverId}
      </Text>

      {friendship.otherUserBio && (
        <>
          <Text style={styles.label}>{t('bio')}</Text>
          <Text style={styles.bio}>{friendship.otherUserBio}</Text>
        </>
      )}

      <View style={styles.actionsContainer}>
        {isPendingReceived && (
          <>
            <Button onPress={() => handleAccept(friendship.id, friendship.serverId)} style={styles.actionButton}>
              {t('accept_request_confirmation_title')}
            </Button>
            <Button onPress={() => handleDecline(friendship.id, friendship.serverId)} style={[styles.actionButton, styles.destructiveButton]}>
              {t('decline_request_confirmation_title')}
            </Button>
            <Button onPress={() => handleBlacklist(friendship.id, friendship.serverId)} style={[styles.actionButton, styles.destructiveButton]}>
              {t('blacklist_confirmation_title')}
            </Button>
          </>
        )}

        {isPendingSent && (
          <Button onPress={() => handleCancel(friendship.id, friendship.serverId)} style={[styles.actionButton, styles.destructiveButton]}>
            {t('cancel_request_confirmation_title')}
          </Button>
        )}

        {isFriend && (
          <>
            <Button onPress={() => handleUnfriend(friendship.id, friendship.serverId)} style={[styles.actionButton, styles.destructiveButton]}>
              {t('unfriend_confirmation_title')}
            </Button>
            <Button onPress={() => handleBlacklist(friendship.id, friendship.serverId)} style={[styles.actionButton, styles.destructiveButton]}>
              {t('blacklist_confirmation_title')}
            </Button>
          </>
        )}

        {isBlacklisted && (
          <Button onPress={() => handleUnblacklist(friendship.id, friendship.serverId)} style={styles.actionButton}>
            {t('unblacklist_confirmation_title')}
          </Button>
        )}
      </View>
    </ScrollView>
  );
};

export default FriendDetailScreen;
