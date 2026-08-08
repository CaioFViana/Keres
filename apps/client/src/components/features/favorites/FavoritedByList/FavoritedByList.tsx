import { FavoriteEntityType } from '@keres/shared';
import { and, eq, or } from 'drizzle-orm';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../../../../db';
import { friendships, servers, stories } from '../../../../db/schema';
import { friendshipApiService } from '../../../../services/FriendshipApiService';
import { createFavoriteService } from '../../../../services/storymanagement/FavoriteService';
import { useUserSettingsStore } from '../../../../state/userSettingsStore';
import { useTheme } from '../../../../theme';
import { entityEventEmitter } from '../../../../utils/EventEmitter';
import Avatar from '../../../common/display/Avatar/Avatar';
import CollapsibleCard from '../../../common/display/CollapsibleCard/CollapsibleCard';

interface FavoritedByListProps {
  storyId: string;
  entityId: string;
  entityType: FavoriteEntityType;
}

interface FavoriterProfile {
  id: string;
  name: string;
  avatarColor?: string | null;
  avatarIcon?: string | null;
  isCurrentUser: boolean;
}

const remoteProfileCache = new Map<string, Promise<FavoriterProfile | undefined>>();

const FavoritedByList: React.FC<FavoritedByListProps> = ({ storyId, entityId, entityType }) => {
  const db = useDrizzle();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { userId: localUserId, username: localUsername } = useUserSettingsStore();
  const [isPublic, setIsPublic] = useState(false);
  const [profiles, setProfiles] = useState<FavoriterProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const resolveProfile = useCallback(async (
    userId: string,
    storyServer: typeof servers.$inferSelect | undefined,
  ): Promise<FavoriterProfile> => {
    if ((!storyServer && userId === localUserId) || storyServer?.idUser === userId) {
      return {
        id: userId,
        name: storyServer?.userName || localUsername || t('user_not_found'),
        isCurrentUser: true,
      };
    }

    if (storyServer) {
      const friendship = await db.query.friendships.findFirst({
        where: and(
          eq(friendships.serverId, storyServer.id),
          or(eq(friendships.senderId, userId), eq(friendships.receiverId, userId)),
        ),
        columns: { friendUsername: true },
      });
      if (friendship) {
        return { id: userId, name: friendship.friendUsername, isCurrentUser: false };
      }

      const cacheKey = `${storyServer.id}:${userId}`;
      let request = remoteProfileCache.get(cacheKey);
      if (!request) {
        request = friendshipApiService.getUserDetails(storyServer, userId)
          .then((user) => user ? ({
            id: user.id,
            name: user.username,
            avatarColor: user.avatarColor,
            avatarIcon: user.avatarIcon,
            isCurrentUser: false,
          }) : undefined)
          .catch(() => {
            remoteProfileCache.delete(cacheKey);
            return undefined;
          });
        remoteProfileCache.set(cacheKey, request);
      }
      const remoteProfile = await request;
      if (remoteProfile) return remoteProfile;
    }

    return { id: userId, name: userId, isCurrentUser: false };
  }, [db, localUserId, localUsername, t]);

  const fetchFavoriters = useCallback(async () => {
    setLoading(true);
    try {
      const favoriteService = createFavoriteService(db);
      const behavior = await favoriteService.getBehavior(storyId);
      if (behavior !== 'individual_public') {
        setIsPublic(false);
        setProfiles([]);
        return;
      }

      setIsPublic(true);
      const story = await db.query.stories.findFirst({
        where: eq(stories.id, storyId),
        columns: { serverId: true },
      });
      const storyServer = story?.serverId
        ? await db.query.servers.findFirst({ where: eq(servers.id, story.serverId) })
        : undefined;
      const userIds = await favoriteService.getFavoriterIds(storyId, entityId, entityType);
      const resolved = await Promise.all(userIds.map((userId) => resolveProfile(userId, storyServer)));
      resolved.sort((a, b) => Number(b.isCurrentUser) - Number(a.isCurrentUser) || a.name.localeCompare(b.name));
      setProfiles(resolved);
    } catch (error) {
      console.error('Failed to load users who favorited the entity:', error);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [db, entityId, entityType, resolveProfile, storyId]);

  useEffect(() => {
    fetchFavoriters();
    const handleFavoriteChange = (changedStoryId: string, changedEntityType: FavoriteEntityType, changedEntityId: string) => {
      if (changedStoryId === storyId && changedEntityType === entityType && changedEntityId === entityId) {
        fetchFavoriters();
      }
    };
    const handleStoryChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) fetchFavoriters();
    };
    entityEventEmitter.on('favorite_changed', handleFavoriteChange);
    entityEventEmitter.on('story_changed', handleStoryChange);
    return () => {
      entityEventEmitter.off('favorite_changed', handleFavoriteChange);
      entityEventEmitter.off('story_changed', handleStoryChange);
    };
  }, [entityId, entityType, fetchFavoriters, storyId]);

  if (!isPublic && !loading) return null;
  if (!isPublic) return null;

  const styles = StyleSheet.create({
    loading: { paddingVertical: 8 },
    emptyText: { color: colors.textSecondary },
    row: { alignItems: 'center', flexDirection: 'row', marginBottom: 10 },
    rowLast: { marginBottom: 0 },
    name: { color: colors.text, flex: 1, fontSize: 15, marginLeft: 10 },
  });

  return (
    <CollapsibleCard title={`${t('favorited_by')} (${profiles.length})`} initialExpanded={false}>
      {loading ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : profiles.length === 0 ? (
        <Text style={styles.emptyText}>{t('favorited_by_empty')}</Text>
      ) : profiles.map((profile, index) => (
        <View key={profile.id} style={[styles.row, index === profiles.length - 1 && styles.rowLast]}>
          <Avatar
            seed={profile.id}
            color={profile.avatarColor}
            icon={profile.avatarIcon}
            size={32}
          />
          <Text style={styles.name}>
            {profile.name}{profile.isCurrentUser ? ` ${t('you_suffix')}` : ''}
          </Text>
        </View>
      ))}
    </CollapsibleCard>
  );
};

export default FavoritedByList;
