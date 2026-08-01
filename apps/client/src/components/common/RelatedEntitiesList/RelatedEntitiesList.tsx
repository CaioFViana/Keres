import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../theme';
import { relationSectionStyleDefs } from '../../RelationManager/relationSectionStyles';

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
const RelatedEntitiesList: React.FC<RelatedEntitiesListProps> = ({ title, noItemsMessage, groupedEntities }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(true);

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

  const hasAnyEntity = Object.values(groupedEntities).some(names => names.length > 0);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => setIsCollapsed(!isCollapsed)} style={styles.collapsibleHeader}>
        <Text style={styles.collapsibleHeaderText}>{title}</Text>
        <Ionicons name={isCollapsed ? 'chevron-down-outline' : 'chevron-up-outline'} size={24} color={colors.text} />
      </TouchableOpacity>

      {!isCollapsed && (
        <View style={styles.collapsibleContent}>
          {!hasAnyEntity ? (
            <Text style={{ color: colors.textSecondary }}>{noItemsMessage}</Text>
          ) : (
            Object.entries(groupedEntities).map(([entityType, names]) => (
              names.length > 0 && (
                <View key={entityType}>
                  <Text style={styles.groupTitle}>{t(`${entityType}_plural`)}</Text>
                  {names.map((name, index) => (
                    <View key={index} style={styles.relationItem}>
                      <Text style={styles.relationText}>{name}</Text>
                    </View>
                  ))}
                </View>
              )
            ))
          )}
        </View>
      )}
    </View>
  );
};

export default RelatedEntitiesList;
