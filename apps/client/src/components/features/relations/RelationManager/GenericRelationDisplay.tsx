import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../../theme';
import { Ionicons } from '@expo/vector-icons';
import { relationSectionStyleDefs } from '@/src/components/features/relations/RelationManager/relationSectionStyles';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';

// Generic types for items and relations, similar to RelationManager
export type BaseItem = { id: string }; // Simpler BaseItem for display
export type BaseRelation = { id: string; isDeleted: boolean }; // isDeleted is useful for filtering

interface GenericRelationDisplayProps<TItem extends BaseItem, TRelation extends BaseRelation> {
  relations: TRelation[];
  getRelatedItem: (itemId: string) => TItem | undefined; // Function to get the actual related item object
  getRelationItemId: (relation: TRelation) => string; // Returns the ID of the TItem in the TRelation
  getItemDisplayName: (item: TItem) => string; // Returns the name/title of the TItem for display
  noItemsMessage: string;
  renderItemExtraContent?: (relation: TRelation, relatedItem: TItem) => React.ReactNode;
  title: string; // Add title prop for the collapsible header
  /**
   * Makes each row navigate to the related item's own Detail screen when tapped. Optional
   * and opt-in: some callers show an entity that doesn't have its own Detail screen to jump
   * to, so the row stays a plain, non-interactive display unless a caller opts in.
   */
  onItemPress?: (item: TItem) => void;
  /**
   * Fechado por padrão, como toda seção de relação. Aberto só onde as relações são o conteúdo
   * principal da tela (o detalhe de um Plot é a lista das cenas dele), e não um apêndice.
   */
  initialExpanded?: boolean;
}

const GenericRelationDisplay = <TItem extends BaseItem, TRelation extends BaseRelation>({
  relations,
  getRelatedItem,
  getRelationItemId,
  getItemDisplayName,
  noItemsMessage,
  renderItemExtraContent,
  title, // Destructure title prop
  onItemPress,
  initialExpanded = false,
}: GenericRelationDisplayProps<TItem, TRelation>) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const styles = StyleSheet.create({
    ...relationSectionStyleDefs(colors),
  });

  const filteredRelations = relations.filter((rel) => !rel.isDeleted);

  return (
    <View style={styles.container}>
      <CollapsibleCard title={title} initialExpanded={initialExpanded}>
        <View>
          {filteredRelations.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>{t(noItemsMessage)}</Text>
          ) : (
            <View>
              {filteredRelations.map((relation) => {
                const relatedItem = getRelatedItem(getRelationItemId(relation));
                if (!relatedItem) return null;

                const content = (
                  <View style={styles.relationItemContent}>
                    {renderItemExtraContent ? (
                      renderItemExtraContent(relation, relatedItem)
                    ) : (
                      <Text style={styles.relationText}>{getItemDisplayName(relatedItem)}</Text>
                    )}
                  </View>
                );

                if (!onItemPress) {
                  return (
                    <View key={relation.id} style={styles.relationItem}>
                      {content}
                    </View>
                  );
                }

                return (
                  <TouchableOpacity
                    key={relation.id}
                    style={styles.relationItem}
                    onPress={() => onItemPress(relatedItem)}
                    activeOpacity={0.7}
                  >
                    {content}
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={colors.textSecondary}
                      style={styles.chevron}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </CollapsibleCard>
    </View>
  );
};

export default GenericRelationDisplay;
