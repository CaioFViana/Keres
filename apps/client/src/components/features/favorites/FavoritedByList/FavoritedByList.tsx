import type { FavoriteEntityType } from '@keres/shared';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFavoriters } from '../../../../hooks/useFavoriters';
import { useTheme } from '../../../../theme';
import Avatar from '../../../common/display/Avatar/Avatar';
import CollapsibleCard from '../../../common/display/CollapsibleCard/CollapsibleCard';
import EntityRelationList from '../../../common/display/EntityRelationList/EntityRelationList';

interface FavoritedByListProps {
  storyId: string;
  entityId: string;
  entityType: FavoriteEntityType;
}

const FavoritedByList: React.FC<FavoritedByListProps> = ({ storyId, entityId, entityType }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { isPublic, profiles, loading } = useFavoriters(storyId, entityId, entityType);

  if (!isPublic && !loading) return null;
  if (!isPublic) return null;

  const styles = StyleSheet.create({
    loading: { paddingVertical: 8 },
    avatar: { marginRight: 10 },
  });

  return (
    <CollapsibleCard title={`${t('favorited_by')} (${profiles.length})`} initialExpanded={false}>
      {loading ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : (
        <EntityRelationList
          emptyText={t('favorited_by_empty')}
          items={profiles.map((profile) => ({
            id: profile.id,
            title: `${profile.name}${profile.isCurrentUser ? ` ${t('you_suffix')}` : ''}`,
            icon: 'person',
            color: profile.avatarColor ?? colors.primary,
            leading: (
              <View style={styles.avatar}>
                <Avatar
                  seed={profile.id}
                  color={profile.avatarColor}
                  icon={profile.avatarIcon}
                  size={32}
                />
              </View>
            ),
          }))}
        />
      )}
    </CollapsibleCard>
  );
};

export default FavoritedByList;
