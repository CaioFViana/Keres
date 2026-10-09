import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import { useTheme } from '../../../theme';

interface FirstStoryStartProps {
  onBlank: () => void;
  onPacks: () => void;
  onExample: () => void;
  onLater: () => void;
}

/**
 * The three ways to have a first story, each said in its own words on its own card: blank, from
 * starter packs, or an example to open and study. What a pack is gets explained here, before the
 * person is taken to the form that asks for one.
 */
const FirstStoryStart: React.FC<FirstStoryStartProps> = ({
  onBlank,
  onPacks,
  onExample,
  onLater,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { isCompact } = useResponsiveLayout();

  const cards: ReadonlyArray<{
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    body: string;
    action: string;
    onPress: () => void;
    primary?: boolean;
  }> = [
    {
      id: 'blank',
      icon: 'document-outline',
      title: t('story_start_blank'),
      body: t('story_start_blank_body'),
      action: t('first_story_blank_action'),
      onPress: onBlank,
      primary: true,
    },
    {
      id: 'packs',
      icon: 'cube-outline',
      title: t('story_start_packs'),
      body: t('story_start_packs_body'),
      action: t('first_story_packs_action'),
      onPress: onPacks,
    },
    {
      id: 'example',
      icon: 'library-outline',
      title: t('first_story_example_title'),
      body: t('first_story_example_body'),
      action: t('first_story_example_action'),
      onPress: onExample,
    },
  ];

  return (
    <View
      style={[styles.panel, { backgroundColor: colors.primaryContainer }]}
      testID="first-story-banner"
    >
      <Text accessibilityRole="header" style={[styles.title, { color: colors.onPrimaryContainer }]}>
        {t('first_story_title')}
      </Text>
      <View style={isCompact ? styles.stacked : styles.row}>
        {cards.map((card) => (
          <View
            key={card.id}
            testID={`first-story-${card.id}`}
            style={[
              styles.card,
              isCompact ? null : styles.cardWide,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.cardHead}>
              <Ionicons name={card.icon} size={22} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>{card.title}</Text>
            </View>
            <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{card.body}</Text>
            <Button
              variant={card.primary ? 'primary' : 'secondary'}
              onPress={card.onPress}
              testID={`first-story-${card.id}-action`}
            >
              {card.action}
            </Button>
          </View>
        ))}
      </View>
      <TouchableOpacity
        style={styles.later}
        onPress={onLater}
        testID="first-story-later"
        accessibilityRole="button"
      >
        <Text style={[styles.laterText, { color: colors.onPrimaryContainer }]}>
          {t('first_story_choice_later')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: { borderRadius: 12, padding: 16, marginBottom: 16, gap: 12 },
  title: { fontSize: 18, fontWeight: 'bold' },
  stacked: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  card: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 10 },
  // flexGrow/flexShrink rather than `flex: 1`, which collapses the width on react-native-web.
  cardWide: { flexGrow: 1, flexShrink: 1, flexBasis: 0, justifyContent: 'space-between' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  cardBody: { fontSize: 14, lineHeight: 20, flexGrow: 1 },
  later: { alignSelf: 'flex-start', paddingVertical: 4 },
  laterText: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});

export default FirstStoryStart;
