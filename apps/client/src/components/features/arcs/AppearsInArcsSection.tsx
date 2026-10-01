import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import EntityRelationList from '@/src/components/common/display/EntityRelationList/EntityRelationList';
import MapIcon from '@/src/components/common/display/MapIcon/MapIcon';
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

  const styles = StyleSheet.create({
    // The same gap the list gives its own glyphs, kept here since `leading` replaces them.
    icon: { marginRight: 10 },
  });

  return (
    <CollapsibleCard
      title={t('appears_in_arcs', { arcs: vocab.term('Arc', true), count: arcs.length })}
      initialExpanded={false}
    >
      <EntityRelationList
        emptyText={t('appears_in_arcs_empty', { arcs: vocab.term('Arc', true) })}
        items={arcs.map((arc) => {
          const color = arc.color || colors.primary;
          return {
            id: arc.id,
            title: arc.title,
            color,
            leading: (
              <View style={styles.icon}>
                <MapIcon name={arc.icon || 'library'} size={20} color={color} />
              </View>
            ),
          };
        })}
      />
    </CollapsibleCard>
  );
};

export default AppearsInArcsSection;
