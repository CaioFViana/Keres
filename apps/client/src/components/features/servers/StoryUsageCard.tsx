import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { StoryEntityUsage } from '@/src/services/storymanagement/story-lifecycle/StoryEntityCountService';
import { type ThemeColors, useTheme } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { planUsageLevel } from '@/src/utils/billing/planUsage';
import { serverCardStyleDefs } from './serverCardStyleDefs';

export interface StoryUsageCardProps {
  stories: readonly StoryEntityUsage[];
  /** The plan's `maxEntitiesPerStory`; `null` is unlimited, and the counts show without a ceiling. */
  limit: number | null;
}

/**
 * How many entities each of the person's stories on a server holds, against the plan's per-story
 * ceiling, so the fullest one is seen without opening any story. The counts are the device's own and
 * follow the same marks as the editor's indicator: warning colour from 90%, alert colour from 95%.
 */
const StoryUsageCard: React.FC<StoryUsageCardProps> = ({ stories, limit }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  if (stories.length === 0) return null;

  const colorOf = (used: number) => {
    const level = planUsageLevel(used, limit);
    return level === 'alert' ? colors.error : level === 'warning' ? colors.accent : colors.text;
  };

  return (
    <View style={styles.card} testID="story-usage-card">
      {stories.map((story, index) => (
        <View
          key={story.id}
          style={[styles.row, index === stories.length - 1 && styles.lastRow]}
          testID={`story-usage-${story.id}`}
        >
          <Text style={[styles.label, styles.title]} numberOfLines={1}>
            {story.title}
          </Text>
          <Text style={[styles.value, { color: colorOf(story.total) }]}>
            {limit === null
              ? String(story.total)
              : t('plan_card_story_items_of', { used: story.total, limit })}
          </Text>
        </View>
      ))}
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ...serverCardStyleDefs(colors),
    title: { flex: 1, color: colors.text },
  });

export default StoryUsageCard;
