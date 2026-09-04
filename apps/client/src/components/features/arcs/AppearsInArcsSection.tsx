import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import EntityRelationList from '@/src/components/common/display/EntityRelationList/EntityRelationList';
import type { StoryArcSelect } from '@/src/db/schema';
import { useTheme } from '@/src/theme';
import { useStoryVocabulary } from '@/src/vocabulary/useStoryVocabulary';

interface Props {
  arcs: StoryArcSelect[];
}

/** Read-only list of Arcs derived from scene membership, not a stored assignment. */
const AppearsInArcsSection: React.FC<Props> = ({ arcs }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const vocab = useStoryVocabulary();

  if (arcs.length === 0) return null;

  return (
    <CollapsibleCard
      title={t('appears_in_arcs', { arcs: vocab.term('Arc', true), count: arcs.length })}
      initialExpanded={false}
    >
      <EntityRelationList
        emptyText={t('appears_in_arcs_empty', { arcs: vocab.term('Arc', true) })}
        items={arcs.map((arc) => ({
          id: arc.id,
          title: arc.title,
          icon: (arc.icon && arc.icon in Ionicons.glyphMap
            ? arc.icon
            : 'library') as keyof typeof Ionicons.glyphMap,
          color: arc.color || colors.primary,
        }))}
      />
    </CollapsibleCard>
  );
};

export default AppearsInArcsSection;
