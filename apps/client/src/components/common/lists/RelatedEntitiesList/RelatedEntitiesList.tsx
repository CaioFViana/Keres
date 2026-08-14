import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../theme';
import { relationSectionStyleDefs } from '@/src/components/features/relations/RelationManager/relationSectionStyles';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';

interface RelatedEntitiesListProps {
  title: string;
  noItemsMessage: string;
  /** Entity type (lowercase, e.g. "character") -> display names of every match. */
  groupedEntities: Record<string, string[]>;
}

/**
 * Read-only "what else references this" section for Note/Tag detail screens - names
 * grouped by entity type. Same collapsible-card look as every other relation section
 * (RelationManager/GenericRelationDisplay) instead of the plain bullet list this used to
 * be, so a note's/tag's related-entities section doesn't stand out as its own thing.
 */
const RelatedEntitiesList: React.FC<RelatedEntitiesListProps> = ({
  title,
  noItemsMessage,
  groupedEntities,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = StyleSheet.create({
    ...relationSectionStyleDefs(colors),
    groupTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 8,
      marginBottom: 4,
    },
  });

  const hasAnyEntity = Object.values(groupedEntities).some((names) => names.length > 0);

  return (
    <View style={styles.container}>
      <CollapsibleCard title={title} initialExpanded={false}>
        <View>
          {!hasAnyEntity ? (
            <Text style={{ color: colors.textSecondary }}>{noItemsMessage}</Text>
          ) : (
            Object.entries(groupedEntities).map(
              ([entityType, names]) =>
                names.length > 0 && (
                  <View key={entityType}>
                    <Text style={styles.groupTitle}>{t(`${entityType}_plural`)}</Text>
                    {names.map((name, index) => (
                      <View key={index} style={styles.relationItem}>
                        <Text style={styles.relationText}>{name}</Text>
                      </View>
                    ))}
                  </View>
                ),
            )
          )}
        </View>
      </CollapsibleCard>
    </View>
  );
};

export default RelatedEntitiesList;
