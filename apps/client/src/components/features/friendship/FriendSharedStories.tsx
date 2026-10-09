import { Ionicons } from '@expo/vector-icons';
import type { SharedStory } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import { useTheme } from '../../../theme';

interface FriendSharedStoriesProps {
  friendName: string;
  /** `null` while unread, or when the server could not be asked. */
  stories: SharedStory[] | null;
  loading: boolean;
  failed: boolean;
  /** Whether the person can still invite: the empty state offers it. */
  canInvite: boolean;
  onOpenStory: (storyId: string) => void;
  onInvite: () => void;
}

/**
 * The stories a friend and the person work on together, with who owns each and the role of the other. It
 * is what a friendship is for here, so it sits on the friend's page and not behind each story's settings.
 */
const FriendSharedStories: React.FC<FriendSharedStoriesProps> = ({
  friendName,
  stories,
  loading,
  failed,
  canInvite,
  onOpenStory,
  onInvite,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const role = (story: SharedStory) =>
    t(story.permissionType === 'writer' ? 'permission_writer' : 'permission_reader');

  return (
    <View testID="friend-shared-stories">
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {t('friend_shared_stories_title')}
      </Text>

      {loading && stories === null && <ActivityIndicator color={colors.primary} />}
      {failed && (
        <Text style={[styles.muted, { color: colors.error }]}>{t('friend_shared_failed')}</Text>
      )}

      {stories !== null && stories.length === 0 && (
        <View style={styles.empty}>
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            {t('friend_shared_empty', { name: friendName })}
          </Text>
          {canInvite && (
            <Button
              variant="secondary"
              onPress={onInvite}
              style={styles.emptyButton}
              testID="friend-shared-invite"
            >
              {t('friend_invite_to_story')}
            </Button>
          )}
        </View>
      )}

      {stories?.map((story) => (
        <Pressable
          key={story.storyId}
          testID={`friend-shared-story-${story.storyId}`}
          accessibilityRole="button"
          accessibilityLabel={story.title}
          onPress={() => onOpenStory(story.storyId)}
          style={({ pressed }) => [
            styles.row,
            { borderColor: colors.border, backgroundColor: colors.surface },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="book-outline" size={24} color={colors.primary} />
          <View style={styles.texts}>
            <Text style={[styles.storyTitle, { color: colors.text }]} numberOfLines={2}>
              {story.title}
            </Text>
            <Text style={[styles.detail, { color: colors.textSecondary }]}>
              {t(story.ownedByMe ? 'friend_shared_yours' : 'friend_shared_theirs', {
                name: friendName,
                role: role(story),
              })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  muted: { fontSize: 14, lineHeight: 20 },
  empty: { gap: 12, alignItems: 'flex-start' },
  emptyButton: { minWidth: 200 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  pressed: { opacity: 0.7 },
  texts: { flex: 1, minWidth: 0 },
  storyTitle: { fontSize: 16, fontWeight: '600' },
  detail: { fontSize: 13, marginTop: 2 },
});

export default FriendSharedStories;
