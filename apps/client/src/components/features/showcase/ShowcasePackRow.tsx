import { Ionicons } from '@expo/vector-icons';
import type { ShowcasePackCard } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/theme';
import { packSummaryChips } from '@/src/utils/format/showcasePacks';

interface ShowcasePackRowProps {
  pack: ShowcasePackCard;
  onPress: () => void;
}

/** A pack of the public site in a list: what it is called, who made it and what it brings. */
const ShowcasePackRow: React.FC<ShowcasePackRowProps> = ({ pack, onPress }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const chips = packSummaryChips(pack.summary, t);
  const meta = [
    pack.language,
    pack.authorName ?? pack.owner.username,
    t('packs_version', { version: pack.version }),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      testID={`showcase-pack-${pack.id}`}
      accessibilityRole="button"
      accessibilityLabel={pack.name}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: colors.border, backgroundColor: colors.surface },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name="archive-outline" size={24} color={colors.primary} />
      <View style={styles.texts}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {pack.name}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
          {meta}
        </Text>
        {pack.description ? (
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
            {pack.description}
          </Text>
        ) : null}
        <Text style={[styles.chips, { color: colors.textSecondary }]} numberOfLines={2}>
          {chips.length > 0 ? chips.join(' · ') : t('packs_chip_empty')}
        </Text>
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
    padding: 12,
    marginBottom: 8,
  },
  pressed: { opacity: 0.7 },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13, fontStyle: 'italic' },
  description: { fontSize: 13 },
  chips: { fontSize: 12, marginTop: 2 },
});

export default ShowcasePackRow;
