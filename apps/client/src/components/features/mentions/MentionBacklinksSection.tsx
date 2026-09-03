import { getEntityAppearance } from '@keres/shared';
import type { NavigableEntityType } from '@/src/utils/entityNavigation';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import EntityRelationList from '@/src/components/common/display/EntityRelationList/EntityRelationList';
import { useNavigateToEntityDetail } from '@/src/hooks/useNavigateToEntityDetail';
import { useMentionBacklinks } from '@/src/mentions/MentionContext';
import { useTheme } from '@/src/theme';

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
    () =>
      StyleSheet.create({
        excerpt: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
      }),
    [colors],
  );
  return (
    <CollapsibleCard
      title={t('backlinks_title', { entities: backlinks.length, mentions: totalMentions })}
      initialExpanded={false}
    >
      <EntityRelationList
        emptyText={t('backlinks_empty')}
        items={backlinks.map((entry) => {
          const appearance = getEntityAppearance(entry.source.type);
          return {
            id: `${entry.source.type}:${entry.source.id}`,
            title: entry.source.name,
            icon: appearance.icon as any,
            color: appearance.color,
            details: (
              <Text style={styles.excerpt} numberOfLines={2}>
                {entry.excerpt}
              </Text>
            ),
            onPress: () => navigate(entry.source.type, entry.source.id),
          };
        })}
      />
    </CollapsibleCard>
  );
};
