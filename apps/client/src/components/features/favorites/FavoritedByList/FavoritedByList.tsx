import type { FavoriteEntityType } from '@keres/shared';
import { eq } from 'drizzle-orm';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../../../../db';
import { servers, stories } from '../../../../db/schema';
import { createFavoriteService } from '../../../../services/storymanagement/FavoriteService';
import { useTheme } from '../../../../theme';
import { entityEventEmitter } from '../../../../utils/EventEmitter';
import type { ResolvedUserProfile } from '../../../../hooks/useUserProfileResolver';
import { useUserProfileResolver } from '../../../../hooks/useUserProfileResolver';
import Avatar from '../../../common/display/Avatar/Avatar';
import CollapsibleCard from '../../../common/display/CollapsibleCard/CollapsibleCard';

interface FavoritedByListProps {
  storyId: string;
  entityId: string;
  entityType: FavoriteEntityType;
}

type FavoriterProfile = ResolvedUserProfile;

const FavoritedByList: React.FC<FavoritedByListProps> = ({ storyId, entityId, entityType }) => {
  const db = useDrizzle();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const resolveProfile = useUserProfileResolver();
  const [isPublic, setIsPublic] = useState(false);
  const [profiles, setProfiles] = useState<FavoriterProfile[]>([]);
  const [loading, setLoading] = useState(true);

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
      const resolved = await Promise.all(
        userIds.map((userId) => resolveProfile(userId, storyServer)),
      );
      resolved.sort(
        (a, b) => Number(b.isCurrentUser) - Number(a.isCurrentUser) || a.name.localeCompare(b.name),
      );
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
    const handleFavoriteChange = (
      changedStoryId: string,
      changedEntityType: FavoriteEntityType,
      changedEntityId: string,
    ) => {
      if (
        changedStoryId === storyId &&
        changedEntityType === entityType &&
        changedEntityId === entityId
      ) {
        fetchFavoriters();
      }
    };
    const handleStoryChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) fetchFavoriters();
    };
    // The `useUserProfileResolver` hook already clears the shared cache of remote profiles when it
    // hears this same event - this listener still exists here only to trigger the
    // refetch of the `profiles` already displayed (the hook does not know about that, it only invalidates the cache).
    const handleFriendshipChange = () => {
      fetchFavoriters();
    };
    entityEventEmitter.on('favorite_changed', handleFavoriteChange);
    entityEventEmitter.on('story_changed', handleStoryChange);
    entityEventEmitter.on('friendship_changed', handleFriendshipChange);
    return () => {
      entityEventEmitter.off('favorite_changed', handleFavoriteChange);
      entityEventEmitter.off('story_changed', handleStoryChange);
      entityEventEmitter.off('friendship_changed', handleFriendshipChange);
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
      ) : (
        profiles.map((profile, index) => (
          <View
            key={profile.id}
            style={[styles.row, index === profiles.length - 1 && styles.rowLast]}
          >
            <Avatar
              seed={profile.id}
              color={profile.avatarColor}
              icon={profile.avatarIcon}
              size={32}
            />
            <Text style={styles.name}>
              {profile.name}
              {profile.isCurrentUser ? ` ${t('you_suffix')}` : ''}
            </Text>
          </View>
        ))
      )}
    </CollapsibleCard>
  );
};

export default FavoritedByList;
