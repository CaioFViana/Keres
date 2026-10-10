import type { sceneHeadingPlan } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { ScreenplayPlace as Place } from '@/src/hooks/useScreenplaySceneContext';
import type { ThemeColors } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export { useScreenplaySceneContext } from '@/src/hooks/useScreenplaySceneContext';

interface ScreenplaySceneHeaderProps {
  place: Place;
  cast: string[];
  plan: ReturnType<typeof sceneHeadingPlan>;
}

/**
 * Above the text of a screenplay scene: the facts the script is built from, and - spoken plainly - where
 * the scene heading will come from, so nobody is surprised by one they did not type (or by its absence).
 */
export const ScreenplaySceneHeader: React.FC<ScreenplaySceneHeaderProps> = ({
  place,
  cast,
  plan,
}) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.box} testID="screenplay-scene-header">
      <Text style={styles.row} testID="screenplay-place">
        <Text style={styles.label}>{t('screenplay_scene_place')}: </Text>
        {place
          ? `${place.name}${place.intExt ? ` (${t(`int_ext_${place.intExt}`)})` : ''}`
          : t('screenplay_scene_no_place')}
      </Text>
      <Text style={styles.row} testID="screenplay-cast">
        <Text style={styles.label}>{t('screenplay_scene_cast')}: </Text>
        {cast.length > 0 ? cast.join(', ') : t('screenplay_scene_no_cast')}
      </Text>
      {plan.heading ? (
        <Text style={styles.row} testID="screenplay-heading">
          <Text style={styles.label}>{t('screenplay_scene_heading')}: </Text>
          <Text style={styles.heading}>{plan.heading.replace(/^\./, '')}</Text>
        </Text>
      ) : null}
      <Text
        style={plan.source === 'none' ? styles.warn : styles.note}
        testID={`screenplay-heading-${plan.source}`}
      >
        {t(`screenplay_scene_heading_${plan.source}`)}
      </Text>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    box: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 4,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    row: { color: colors.text },
    label: { color: colors.textSecondary, fontWeight: '700' },
    heading: { color: colors.text, fontFamily: 'Courier', fontWeight: '700' },
    note: { color: colors.textSecondary, lineHeight: 18 },
    warn: { color: colors.error, lineHeight: 18 },
  });
