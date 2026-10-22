import { Ionicons } from '@expo/vector-icons';
import type { ShowcaseStoryCard } from '@keres/shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/theme';

interface ShowcaseStoryRowProps {
  story: ShowcaseStoryCard;
  /** The cover's address, for a story that has one; a picture that does not load leaves the plain icon. */
  coverUrl: string | null;
  /** Shows who published it: the author's own page lists their stories, so there it is left out. */
  showOwner?: boolean;
  onPress: () => void;
}

/** A story of the public site in a list: its cover, title, who published it and what kind of story it is. */
const ShowcaseStoryRow: React.FC<ShowcaseStoryRowProps> = ({
  story,
  coverUrl,
  showOwner = true,
  onPress,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [coverFailed, setCoverFailed] = useState(false);
  const { snapshot, owner } = story;
  const facts = [
    snapshot.genre,
    t(snapshot.type === 'branching' ? 'showcase_type_branching' : 'showcase_type_linear'),
    t('showcase_version_count', { count: story.versionCount }),
  ].filter(Boolean);

  return (
    <Pressable
      testID={`showcase-story-${story.storyId}`}
      accessibilityRole="button"
      accessibilityLabel={snapshot.title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: colors.border, backgroundColor: colors.surface },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[styles.cover, { backgroundColor: colors.background, borderColor: colors.border }]}
      >
        {coverUrl && !coverFailed ? (
          <Image
            source={{ uri: coverUrl }}
            style={styles.coverImage}
            resizeMode="cover"
            onError={() => setCoverFailed(true)}
            testID={`showcase-cover-${story.storyId}`}
          />
        ) : (
          <Ionicons name="book-outline" size={26} color={colors.textSecondary} />
        )}
      </View>
      <View style={styles.texts}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {snapshot.title}
        </Text>
        {showOwner ? (
          <Text style={[styles.detail, { color: colors.textSecondary }]} numberOfLines={1}>
            {t('showcase_published_by', { name: owner.username, tag: owner.tag })}
          </Text>
        ) : null}
        <Text style={[styles.detail, { color: colors.textSecondary }]} numberOfLines={1}>
          {facts.join(' · ')}
        </Text>
        {story.isNsfw ? (
          <Text style={[styles.badge, { color: colors.error, borderColor: colors.error }]}>
            {t('showcase_adults_only')}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  pressed: { opacity: 0.7 },
  cover: {
    width: 52,
    height: 72,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverImage: { width: '100%', height: '100%' },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, fontWeight: '600' },
  detail: { fontSize: 13 },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    marginTop: 2,
  },
});

export default ShowcaseStoryRow;
