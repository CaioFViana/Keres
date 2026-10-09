import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import { useTheme } from '../../../theme';

export type StoryStart = 'blank' | 'packs';

interface StoryStartChoiceProps {
  value: StoryStart;
  onChange: (value: StoryStart) => void;
  disabled?: boolean;
  /** What the "packs" option opens up: shown right under the two options, only while it is chosen. */
  children?: React.ReactNode;
}

const OPTIONS: ReadonlyArray<{
  id: StoryStart;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  bodyKey: string;
}> = [
  {
    id: 'blank',
    icon: 'document-outline',
    titleKey: 'story_start_blank',
    bodyKey: 'story_start_blank_body',
  },
  {
    id: 'packs',
    icon: 'cube-outline',
    titleKey: 'story_start_packs',
    bodyKey: 'story_start_packs_body',
  },
];

/**
 * The first thing a new story asks: start from nothing, or from a starter pack. Each option says what
 * it is in its own words, so the choice is understood before it is made, and the packs' own
 * controls open right under it instead of waiting at the end of the form.
 */
const StoryStartChoice: React.FC<StoryStartChoiceProps> = ({
  value,
  onChange,
  disabled,
  children,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { isCompact } = useResponsiveLayout();

  return (
    <View testID="story-start-choice" style={styles.root}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {t('story_start_title')}
      </Text>
      <View style={isCompact ? styles.optionsStacked : styles.optionsRow}>
        {OPTIONS.map((option) => {
          const selected = value === option.id;
          return (
            <Pressable
              key={option.id}
              testID={`story-start-${option.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: !!disabled }}
              disabled={disabled}
              onPress={() => onChange(option.id)}
              style={({ pressed }) => [
                styles.option,
                isCompact ? null : styles.optionWide,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primaryContainer : colors.surface,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons
                name={option.icon}
                size={24}
                color={selected ? colors.onPrimaryContainer : colors.textSecondary}
              />
              <View style={styles.optionTexts}>
                <Text
                  style={[
                    styles.optionTitle,
                    { color: selected ? colors.onPrimaryContainer : colors.text },
                  ]}
                >
                  {t(option.titleKey)}
                </Text>
                <Text
                  style={[
                    styles.optionBody,
                    { color: selected ? colors.onPrimaryContainer : colors.textSecondary },
                  ]}
                >
                  {t(option.bodyKey)}
                </Text>
              </View>
              {selected && (
                <Ionicons name="checkmark-circle" size={22} color={colors.onPrimaryContainer} />
              )}
            </Pressable>
          );
        })}
      </View>
      {value === 'packs' && children ? <View style={styles.opened}>{children}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { marginBottom: 12 },
  title: { fontSize: 16, fontWeight: 'bold', marginTop: 10, marginBottom: 8 },
  optionsStacked: { gap: 10 },
  optionsRow: { flexDirection: 'row', gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 14,
  },
  // flexGrow/flexShrink rather than `flex: 1`, which collapses the width on react-native-web.
  optionWide: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  optionTexts: { flexGrow: 1, flexShrink: 1, gap: 4 },
  optionTitle: { fontSize: 16, fontWeight: '700' },
  optionBody: { fontSize: 14, lineHeight: 20 },
  opened: { marginTop: 14 },
});

export default StoryStartChoice;
