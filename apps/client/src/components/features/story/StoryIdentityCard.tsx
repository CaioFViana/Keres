import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/theme';

interface StoryIdentityCardProps {
  type: 'linear' | 'branching';
  genre?: string | null;
  author?: string | null;
  /** The language as the person knows it ("English"), not its code. */
  language?: string | null;
  description?: string | null;
  extraNotes?: string | null;
  /** Set for a story that syncs: the last server log it has caught up with. */
  syncedLog?: number | null;
}

/** Past this many characters (or lines) a text is folded to a few lines with a way to open it. */
const FOLD_CHARACTERS = 150;
const FOLD_LINES = 3;

const FoldedText: React.FC<{ icon: keyof typeof Ionicons.glyphMap; text: string }> = ({
  icon,
  text,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const long = text.length > FOLD_CHARACTERS || text.split('\n').length > FOLD_LINES;
  return (
    <View style={styles.textRow}>
      <Ionicons name={icon} size={16} color={colors.textSecondary} style={styles.textIcon} />
      <View style={styles.grow}>
        <Text
          style={[styles.body, { color: colors.text }]}
          numberOfLines={long && !open ? FOLD_LINES : undefined}
        >
          {text}
        </Text>
        {long ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen((current) => !current)}
          >
            <Text style={[styles.more, { color: colors.primary }]}>
              {t(open ? 'story_summary_less' : 'story_summary_more')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

/**
 * What a story is, in as little room as it can: whether it branches as an icon, its genre, language
 * and author as small tags, and its description and notes folded to a few lines. Anything blank is
 * left out instead of shown as an empty field.
 */
const StoryIdentityCard: React.FC<StoryIdentityCardProps> = ({
  type,
  genre,
  author,
  language,
  description,
  extraNotes,
  syncedLog,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const tags: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: 'pricetag-outline' as const, text: genre?.trim() ?? '' },
    { icon: 'language-outline' as const, text: language ?? '' },
    { icon: 'person-outline' as const, text: author?.trim() ?? '' },
  ].filter((tag) => tag.text.length > 0);
  const branching = type === 'branching';
  const kind = t(branching ? 'branching' : 'linear');
  const about = description?.trim();
  const notes = extraNotes?.trim();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.tags}>
        <View
          accessible
          accessibilityLabel={kind}
          style={[styles.kind, { backgroundColor: colors.primaryContainer }]}
        >
          <Ionicons
            name={branching ? 'git-branch-outline' : 'arrow-forward-outline'}
            size={16}
            color={colors.onPrimaryContainer}
          />
        </View>
        {tags.map((tag) => (
          <View key={tag.icon} style={styles.tag}>
            <Ionicons name={tag.icon} size={15} color={colors.textSecondary} />
            <Text style={[styles.tagText, { color: colors.text }]}>{tag.text}</Text>
          </View>
        ))}
      </View>
      {about ? <FoldedText icon="reader-outline" text={about} /> : null}
      {notes ? <FoldedText icon="document-text-outline" text={notes} /> : null}
      {syncedLog ? (
        <View style={styles.sync}>
          <Ionicons name="cloud-done-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.syncText, { color: colors.textSecondary }]}>{syncedLog}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, gap: 10, marginTop: 8, padding: 14 },
  tags: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kind: {
    alignItems: 'center',
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  tag: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  tagText: { fontSize: 14, fontWeight: '600' },
  textRow: { flexDirection: 'row', gap: 8 },
  textIcon: { marginTop: 2 },
  grow: { flexGrow: 1, flexShrink: 1 },
  body: { fontSize: 15, lineHeight: 21 },
  more: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  sync: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  syncText: { fontSize: 12 },
});

export default StoryIdentityCard;
