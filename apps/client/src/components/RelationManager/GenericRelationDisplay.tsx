import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { relationSectionStyleDefs } from './relationSectionStyles';


// Generic types for items and relations, similar to RelationManager
export type BaseItem = { id: string; }; // Simpler BaseItem for display
export type BaseRelation = { id: string; isDeleted: boolean; }; // isDeleted is useful for filtering

interface GenericRelationDisplayProps<TItem extends BaseItem, TRelation extends BaseRelation> {
  relations: TRelation[];
  getRelatedItem: (itemId: string) => TItem | undefined; // Function to get the actual related item object
  getRelationItemId: (relation: TRelation) => string; // Returns the ID of the TItem in the TRelation
  getItemDisplayName: (item: TItem) => string; // Returns the name/title of the TItem for display
  noItemsMessage: string;
  renderItemExtraContent?: (relation: TRelation, relatedItem: TItem) => React.ReactNode;
  title: string; // Add title prop for the collapsible header
}

const GenericRelationDisplay = <TItem extends BaseItem, TRelation extends BaseRelation>({
  relations,
  getRelatedItem,
  getRelationItemId,
  getItemDisplayName,
  noItemsMessage,
  renderItemExtraContent,
  title, // Destructure title prop
}: GenericRelationDisplayProps<TItem, TRelation>) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [isCollapsed, setIsCollapsed] = useState(true); // Add isCollapsed state, default to true

  const styles = StyleSheet.create({
    ...relationSectionStyleDefs(colors),
  });

  const filteredRelations = relations.filter(rel => !rel.isDeleted);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => setIsCollapsed(!isCollapsed)} style={styles.collapsibleHeader}>
        <Text style={styles.collapsibleHeaderText}>{title}</Text>
        <Ionicons name={isCollapsed ? 'chevron-down-outline' : 'chevron-up-outline'} size={24} color={colors.text} />
      </TouchableOpacity>

      {!isCollapsed && (
        <View style={styles.collapsibleContent}>
          {filteredRelations.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>{t(noItemsMessage)}</Text>
          ) : (
            <View>
              {filteredRelations.map(relation => {
                const relatedItem = getRelatedItem(getRelationItemId(relation));
                if (!relatedItem) return null;

                return (
                  <View key={relation.id} style={styles.relationItem}>
                    {renderItemExtraContent ? (
                      renderItemExtraContent(relation, relatedItem)
                    ) : (
                      <Text style={styles.relationText}>{getItemDisplayName(relatedItem)}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default GenericRelationDisplay;
