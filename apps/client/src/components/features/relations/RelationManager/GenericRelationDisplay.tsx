import type { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../theme';
import { relationSectionStyleDefs } from '@/src/components/features/relations/RelationManager/relationSectionStyles';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import EntityRelationList from '@/src/components/common/display/EntityRelationList/EntityRelationList';

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
   * Closed by default, like every relation section. Open only where the relations are the screen's
   * main content (a Plot's detail is the list of its scenes), and not an appendix.
   */
  initialExpanded?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
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
  icon = 'link-outline',
  color,
}: GenericRelationDisplayProps<TItem, TRelation>) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const styles = StyleSheet.create({
    ...relationSectionStyleDefs(colors),
  });

  const filteredRelations = relations.filter((rel) => !rel.isDeleted);
  const items = useMemo(
    () =>
      filteredRelations.flatMap((relation) => {
        const relatedItem = getRelatedItem(getRelationItemId(relation));
        if (!relatedItem) return [];
        const details = renderItemExtraContent?.(relation, relatedItem);
        return [
          {
            id: relation.id,
            title: details ? '' : getItemDisplayName(relatedItem),
            icon,
            color: color ?? colors.primary,
            details,
            onPress: onItemPress ? () => onItemPress(relatedItem) : undefined,
          },
        ];
      }),
    [
      color,
      colors.primary,
      filteredRelations,
      getItemDisplayName,
      getRelatedItem,
      getRelationItemId,
      icon,
      onItemPress,
      renderItemExtraContent,
    ],
  );

  return (
    <View style={styles.container}>
      <CollapsibleCard title={title} initialExpanded={initialExpanded}>
        <EntityRelationList items={items} emptyText={t(noItemsMessage)} />
      </CollapsibleCard>
    </View>
  );
};

export default GenericRelationDisplay;
