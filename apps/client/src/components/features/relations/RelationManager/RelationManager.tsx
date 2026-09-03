import type { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import EntityRelationList from '@/src/components/common/display/EntityRelationList/EntityRelationList';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { useTheme } from '../../../../theme';
import { relationSectionStyleDefs } from './relationSectionStyles';

export type BaseItem = { id: string; isDeleted: boolean };
export type BaseRelation = {
  id: string;
  storyId: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
};

interface Props<TItem extends BaseItem, TRelation extends BaseRelation> {
  relations: TRelation[];
  availableItems: TItem[];
  onSave: (relation: TRelation) => Promise<void>;
  onDelete: (relationId: string) => Promise<void>;
  editable: boolean;
  currentStoryId: string;
  currentEntityId: string;
  createRelationObject: (
    selectedItemId: string,
    storyId: string,
    currentEntityId: string,
  ) => TRelation;
  getRelationItemId: (relation: TRelation) => string;
  getItemDisplayName: (item: TItem) => string;
  getItemSearchValue: (item: TItem) => string;
  filterAvailableItems: (
    item: TItem,
    relations: TRelation[],
    getRelationItemId: (relation: TRelation) => string,
  ) => boolean;
  selectItemPlaceholder: string;
  noItemsAssignedMessage: string;
  itemAlreadyAddedMessage: string;
  selectItemToAddMessage: string;
  deleteConfirmationTitle: string;
  deleteConfirmationMessage: string;
  renderRelationItemExtraContent?: (
    relation: TRelation,
    availableItems: TItem[],
  ) => React.ReactNode;
  title: string;
  onItemPress?: (item: TItem) => void;
  itemIcon?: keyof typeof Ionicons.glyphMap;
  itemColor?: string;
}

/** Generic relation persistence with the shared multi-selection and list presentation. */
const RelationManager = <TItem extends BaseItem, TRelation extends BaseRelation>(
  props: Props<TItem, TRelation>,
) => {
  const { availableItems, filterAvailableItems, getRelationItemId } = props;
  const { t } = useTranslation();
  const { colors } = useTheme();
  const activeRelations = useMemo(
    () => props.relations.filter((relation) => !relation.isDeleted),
    [props.relations],
  );
  const selectedValues = useMemo(
    () => activeRelations.map(props.getRelationItemId),
    [activeRelations, props.getRelationItemId],
  );
  const availableForPicker = useMemo(
    () =>
      availableItems.filter(
        (item) =>
          !item.isDeleted &&
          (selectedValues.includes(item.id) ||
            filterAvailableItems(item, activeRelations, getRelationItemId)),
      ),
    [activeRelations, availableItems, filterAvailableItems, getRelationItemId, selectedValues],
  );
  const changeSelection = useCallback(
    async (ids: string[]) => {
      const desired = new Set(ids);
      const existing = new Set(selectedValues);
      for (const relation of activeRelations)
        if (!desired.has(props.getRelationItemId(relation))) await props.onDelete(relation.id);
      for (const id of ids)
        if (!existing.has(id))
          await props.onSave(
            props.createRelationObject(id, props.currentStoryId, props.currentEntityId),
          );
    },
    [activeRelations, props, selectedValues],
  );
  const items = useMemo(
    () =>
      activeRelations.flatMap((relation) => {
        const item = props.availableItems.find(
          (candidate) => candidate.id === props.getRelationItemId(relation),
        );
        if (!item) return [];
        const details = props.renderRelationItemExtraContent?.(relation, props.availableItems);
        return [
          {
            id: relation.id,
            title: details ? '' : props.getItemDisplayName(item),
            icon: props.itemIcon ?? 'link-outline',
            color: props.itemColor ?? colors.primary,
            details,
            onPress:
              props.onItemPress && !props.editable ? () => props.onItemPress?.(item) : undefined,
          },
        ];
      }),
    [activeRelations, colors.primary, props],
  );
  const styles = relationSectionStyleDefs(colors);
  return (
    <View style={styles.container}>
      <CollapsibleCard title={props.title} initialExpanded={false}>
        {props.editable && (
          <MultiSelectPill
            options={availableForPicker.map((item) => ({
              label: props.getItemDisplayName(item),
              value: item.id,
              color: props.itemColor,
            }))}
            selectedValues={selectedValues}
            onSelectionChange={(ids) => void changeSelection(ids)}
            placeholder={props.selectItemPlaceholder}
            noOptionsText={props.selectItemToAddMessage}
          />
        )}
        <EntityRelationList items={items} emptyText={t(props.noItemsAssignedMessage)} />
      </CollapsibleCard>
    </View>
  );
};

export default RelationManager;
