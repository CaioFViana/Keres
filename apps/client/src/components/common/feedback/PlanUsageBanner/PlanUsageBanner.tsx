import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { usePlanUsageStore } from '../../../../state/planUsageStore';
import { useStoryStore } from '../../../../state/storyStore';
import { useTheme } from '../../../../theme';

/**
 * The editor's note that the open story is getting close to its owner's plan: from 90% of a ceiling it
 * is a warning, from 95% an alert, and at the ceiling it says nothing more can be created. Shows nothing
 * while the story is well inside its limits, has no plan, or the summary belongs to another story.
 */
const PlanUsageBanner: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const storyId = useStoryStore((state) => state.selectedStory?.id);
  const summary = usePlanUsageStore((state) => (state.storyId === storyId ? state.summary : null));
  const worst = summary?.worst;
  if (!worst) return null;

  const reached = worst.used >= worst.limit;
  const color = worst.level === 'alert' ? colors.error : colors.accent;
  const percent = Math.min(100, Math.floor((worst.used / Math.max(1, worst.limit)) * 100));
  const message = t(`plan_usage_${reached ? 'reached' : 'banner'}_${worst.scope}`, {
    used: worst.used,
    limit: worst.limit,
    percent,
  });

  return (
    <View
      testID="plan-usage-banner"
      accessibilityRole="alert"
      style={[styles.banner, { borderColor: color, backgroundColor: colors.surface }]}
    >
      <Ionicons name="warning-outline" size={20} color={color} />
      <Text style={[styles.text, { color: colors.text }]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  text: { flex: 1, fontSize: 13, lineHeight: 18 },
});

export default PlanUsageBanner;
