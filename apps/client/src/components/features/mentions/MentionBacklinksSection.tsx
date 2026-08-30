import { Ionicons } from '@expo/vector-icons';
import type { NavigableEntityType } from '@/src/utils/entityNavigation';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import { useNavigateToEntityDetail } from '@/src/hooks/useNavigateToEntityDetail';
import { useMentionBacklinks } from '@/src/mentions/MentionContext';
import { useTheme } from '@/src/theme';
import { ENTITY_TYPE_ICONS } from '@/src/utils/entityTypeIcons';

interface Props {
  entityType: NavigableEntityType;
  entityId: string;
}

/** The read-only counterpart to See also: derived from the story's automatic prose links. */
export const MentionBacklinksSection: React.FC<Props> = ({ entityType, entityId }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigate = useNavigateToEntityDetail();
  const backlinks = useMentionBacklinks(entityType, entityId);
  const totalMentions = backlinks.reduce((total, entry) => total + entry.mentionCount, 0);
  const styles = useMemo(
    () => StyleSheet.create({
      row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      rowLast: { borderBottomWidth: 0 },
      content: { flex: 1, minWidth: 0 },
      title: { color: colors.text, fontSize: 15, fontWeight: '600' },
      excerpt: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
      empty: { color: colors.textSecondary, fontStyle: 'italic', paddingVertical: 8 },
    }),
    [colors],
  );
  return <CollapsibleCard title={t('backlinks_title', { entities: backlinks.length, mentions: totalMentions })} initialExpanded={false}>
    {backlinks.length === 0 ? <Text style={styles.empty}>{t('backlinks_empty')}</Text> : backlinks.map((entry, index) => <TouchableOpacity key={`${entry.source.type}:${entry.source.id}`} style={[styles.row, index === backlinks.length - 1 && styles.rowLast]} onPress={() => navigate(entry.source.type, entry.source.id)} accessibilityLabel={t('backlinks_open_source', { name: entry.source.name })}>
      <Ionicons name={ENTITY_TYPE_ICONS[entry.source.type]} color={colors.primary} size={20} />
      <View style={styles.content}><Text style={styles.title} numberOfLines={1}>{entry.source.name}</Text><Text style={styles.excerpt} numberOfLines={2}>{entry.excerpt}</Text></View>
      <Ionicons name="chevron-forward" color={colors.textSecondary} size={18} />
    </TouchableOpacity>)}
  </CollapsibleCard>;
};
