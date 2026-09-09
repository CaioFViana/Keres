import { Ionicons } from '@expo/vector-icons';
import type { Story } from '@keres/shared/entities/Story';
import type { ThemeColors } from '@keres/shared';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useThemeColors } from '../../../theme/useThemeColors';

export type StorySelectionListItemProps = {
  story: Story;
  serverName: string | undefined;
  onSelectStory: (story: Story) => void;
  onToggleFavorite: (storyId: string, currentFavoriteStatus: boolean) => void;
  onEditStory: (storyId: string) => void;
};

/**
 * Catalog card for the story picker: keeps each story's theme identity via an accent
 * stripe and themed surface, without the heavy full-bleed border of the old row.
 */
const StorySelectionListItem: React.FC<StorySelectionListItemProps> = ({
  story,
  serverName,
  onSelectStory,
  onToggleFavorite,
  onEditStory,
}) => {
  const { t } = useTranslation();
  const theme = useThemeColors(story.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const typeIcon = story.type === 'branching' ? 'git-branch-outline' : 'book-outline';
  const typeLabel = story.type === 'branching' ? t('branching') : t('linear');
  const metaParts = [story.genre?.trim() || null, story.serverId ? serverName || story.serverId : null].filter(
    Boolean,
  ) as string[];

  return (
    <Pressable
      onPress={() => onSelectStory(story)}
      accessibilityRole="button"
      accessibilityLabel={story.title}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.accent} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {story.title}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.typeBadge}>
            <Ionicons name={typeIcon} size={14} color={theme.primary} />
            <Text style={styles.typeBadgeText}>{typeLabel}</Text>
          </View>
          {metaParts.length > 0 ? (
            <Text style={styles.metaText} numberOfLines={1}>
              {metaParts.join(' · ')}
            </Text>
          ) : null}
        </View>

        {!!story.description?.trim() && (
          <Text style={styles.description} numberOfLines={2}>
            {story.description.trim()}
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={(event) => {
            event.stopPropagation();
            onToggleFavorite(story.id, story.isFavorite);
          }}
          style={styles.actionButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('favorite')}
          accessibilityState={{ selected: story.isFavorite }}
        >
          <Ionicons
            name={story.isFavorite ? 'star' : 'star-outline'}
            size={22}
            color={story.isFavorite ? theme.star : theme.textSecondary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={(event) => {
            event.stopPropagation();
            onEditStory(story.id);
          }}
          style={styles.actionButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('edit_story')}
        >
          <Ionicons name="pencil-outline" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </Pressable>
  );
};

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'stretch',
      marginBottom: 10,
      marginRight: 8,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.card,
      overflow: 'hidden',
      minHeight: 72,
    },
    cardPressed: {
      opacity: 0.92,
    },
    accent: {
      width: 5,
      backgroundColor: theme.primary,
    },
    body: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 14,
      justifyContent: 'center',
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.text,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 6,
    },
    typeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.primaryContainer,
    },
    typeBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.onPrimaryContainer,
    },
    metaText: {
      flexShrink: 1,
      fontSize: 12,
      color: theme.textSecondary,
    },
    description: {
      marginTop: 6,
      fontSize: 13,
      lineHeight: 18,
      color: theme.textSecondary,
    },
    actions: {
      justifyContent: 'center',
      paddingRight: 6,
      paddingVertical: 4,
      gap: 2,
    },
    actionButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export default StorySelectionListItem;
