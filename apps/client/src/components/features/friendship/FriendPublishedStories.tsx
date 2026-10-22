import { Ionicons } from '@expo/vector-icons';
import type { ShowcaseStoryCard } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import { useTheme } from '@/src/theme';

/** How many stories the friend's page lists before pointing at the author page for the rest. */
export const FRIEND_PUBLISHED_PREVIEW = 3;

interface FriendPublishedStoriesProps {
  friendName: string;
  /** The stories the friend has on show on their server's public site, newest first. */
  stories: ShowcaseStoryCard[];
  onOpenStory: (storyId: string) => void;
  onOpenAuthorPage: () => void;
}

/**
 * A short look at what a friend has published, so the friend's page says what they write and not only what
 * the two do together. Only the first few: the author page, a button away, has the rest.
 */
const FriendPublishedStories: React.FC<FriendPublishedStoriesProps> = ({
  friendName,
  stories,
  onOpenStory,
  onOpenAuthorPage,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const shown = stories.slice(0, FRIEND_PUBLISHED_PREVIEW);
  const hidden = stories.length - shown.length;

  return (
    <View testID="friend-published-stories">
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {t('friend_published_title', { name: friendName })}
      </Text>

      {shown.map((story) => (
        <Pressable
          key={story.storyId}
          testID={`friend-published-story-${story.storyId}`}
          accessibilityRole="link"
          accessibilityLabel={story.snapshot.title}
          onPress={() => onOpenStory(story.storyId)}
          style={({ pressed }) => [
            styles.row,
            { borderColor: colors.border, backgroundColor: colors.surface },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="globe-outline" size={22} color={colors.primary} />
          <View style={styles.texts}>
            <Text style={[styles.storyTitle, { color: colors.text }]} numberOfLines={2}>
              {story.snapshot.title}
            </Text>
            {story.snapshot.genre ? (
              <Text style={[styles.detail, { color: colors.textSecondary }]} numberOfLines={1}>
                {story.snapshot.genre}
              </Text>
            ) : null}
          </View>
          <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      ))}

      <Button
        variant="secondary"
        icon="person-circle-outline"
        onPress={onOpenAuthorPage}
        style={styles.more}
        testID="friend-published-more"
      >
        {hidden > 0 ? t('friend_published_more', { count: hidden }) : t('friend_author_page')}
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
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
  more: { alignSelf: 'flex-start', marginTop: 4 },
});

export default FriendPublishedStories;
