import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';
import Select from '@/src/components/common/inputs/Select/Select';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput'; // Import TextInput
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import RelationRow from '@/src/components/features/relations/RelationManager/RelationRow';
import { relationSectionStyleDefs } from '@/src/components/features/relations/RelationManager/relationSectionStyles';
import { AppAlert } from '../../../../utils/AppAlert';

// Generic types for items and relations
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

interface RelationManagerProps<TItem extends BaseItem, TRelation extends BaseRelation> {
  relations: TRelation[];
  availableItems: TItem[];
  onSave: (relation: TRelation) => Promise<void>;
  onDelete: (relationId: string) => Promise<void>;
  editable: boolean;
  currentStoryId: string;
  currentEntityId: string; // The ID of the entity this relation is tied to (e.g., SceneId, CharacterId)
  createRelationObject: (
    selectedItemId: string,
    storyId: string,
    currentEntityId: string,
  ) => TRelation;
  getRelationItemId: (relation: TRelation) => string; // Returns the ID of the TItem in the TRelation
  getItemDisplayName: (item: TItem) => string; // Returns the name/title of the TItem for display
  getItemSearchValue: (item: TItem) => string; // Returns the value of the TItem for searching
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
  title: string; // Add title prop for the collapsible header
  /** Same opt-in navigation affordance as GenericRelationDisplay: row becomes tappable, with a chevron, and navigates to the related item's own Detail screen. Independent of `editable` - the delete button (if any) is its own touch target and doesn't trigger this. */
  onItemPress?: (item: TItem) => void;
}

const RelationManager = <TItem extends BaseItem, TRelation extends BaseRelation>({
  relations,
  availableItems,
  onSave,
  onDelete,
  editable,
  currentStoryId,
  currentEntityId,
  createRelationObject,
  getRelationItemId,
  getItemDisplayName,
  getItemSearchValue,
  filterAvailableItems,
  selectItemPlaceholder,
  noItemsAssignedMessage,
  itemAlreadyAddedMessage,
  selectItemToAddMessage,
  deleteConfirmationTitle,
  deleteConfirmationMessage,
  renderRelationItemExtraContent,
  title, // Destructure title prop
  onItemPress,
}: RelationManagerProps<TItem, TRelation>) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [selectedItemIdToAdd, setSelectedItemIdToAdd] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const styles = StyleSheet.create({
    ...relationSectionStyleDefs(colors),
    addRelationContainer: {
      marginTop: 15,
      marginBottom: 10,
      gap: 10,
    },
    dropdown: {
      width: '100%',
      zIndex: 2,
    },
    addButton: {
      alignItems: 'center',
      paddingVertical: 14,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    addButtonText: {
      color: colors.onPrimary,
      fontWeight: 'bold',
    },
    searchInput: {
      width: '100%',
      // marginBottom: 10,
      // You might want to get common input styles from theme, for now basic
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 5,
      padding: 10,
      color: colors.text,
      fontSize: 16,
      marginBottom: 10,
    },
    selectAddRow: {
      gap: 10,
    },
  });

  const activeRelations = relations.filter((relation) => !relation.isDeleted);

  const handleAddRelation = useCallback(async () => {
    if (!selectedItemIdToAdd) {
      AppAlert.alert(t('error'), selectItemToAddMessage);
      return;
    }

    // Check for duplicates using the generic getRelationItemId
    const itemExists = activeRelations.some(
      (rel) => getRelationItemId(rel) === selectedItemIdToAdd,
    );
    if (itemExists) {
      AppAlert.alert(t('error'), itemAlreadyAddedMessage);
      return;
    }

    const newRelation = createRelationObject(selectedItemIdToAdd, currentStoryId, currentEntityId);

    await onSave(newRelation);
    setSelectedItemIdToAdd(null);
    setSearchTerm(''); // Clear search term after adding
  }, [
    selectedItemIdToAdd,
    activeRelations,
    currentStoryId,
    currentEntityId,
    createRelationObject,
    getRelationItemId,
    onSave,
    t,
    selectItemToAddMessage,
    itemAlreadyAddedMessage,
  ]);

  const handleDeleteRelation = useCallback(
    async (relationId: string) => {
      AppAlert.alert(
        deleteConfirmationTitle,
        deleteConfirmationMessage,
        [
          {
            text: t('cancel'),
            style: 'cancel',
          },
          {
            text: t('delete'),
            onPress: async () => {
              await onDelete(relationId);
            },
            style: 'destructive',
          },
        ],
        { cancelable: true },
      );
    },
    [onDelete, t, deleteConfirmationTitle, deleteConfirmationMessage],
  );

  const filteredAvailableItems = availableItems
    .filter((item) => filterAvailableItems(item, activeRelations, getRelationItemId))
    .filter((item) => getItemSearchValue(item).toLowerCase().includes(searchTerm.toLowerCase()));

  const availableItemOptions = filteredAvailableItems.map((item) => ({
    label: getItemDisplayName(item),
    value: item.id,
  }));

  const renderRelationItem = (relation: TRelation) => {
    const relatedItem = availableItems.find((item) => item.id === getRelationItemId(relation));
    if (!relatedItem) return null;

    const content = renderRelationItemExtraContent ? (
      renderRelationItemExtraContent(relation, availableItems)
    ) : (
      <Text style={styles.relationText}>{getItemDisplayName(relatedItem)}</Text>
    );

    return (
      <RelationRow
        key={relation.id}
        /* Only navigates outside a form: while `editable`, leaving the screen would drop the
           form's unsaved changes - the same rule that hides the chevron. */
        onPress={onItemPress && !editable ? () => onItemPress(relatedItem) : undefined}
        onRemove={editable ? () => handleDeleteRelation(relation.id) : undefined}
      >
        {content}
      </RelationRow>
    );
  };

  return (
    <View style={styles.container}>
      <CollapsibleCard title={title} initialExpanded={false}>
        <View>
          {editable && (
            <View style={styles.addRelationContainer}>
              <TextInput
                placeholder={t('search')}
                value={searchTerm}
                onChangeText={setSearchTerm}
                style={styles.searchInput}
              />
              <View style={styles.selectAddRow}>
                <View style={styles.dropdown}>
                  <Select
                    options={availableItemOptions}
                    value={selectedItemIdToAdd}
                    onValueChange={(value: string | null) => setSelectedItemIdToAdd(value)}
                    placeholder={selectItemPlaceholder}
                    multiple={false}
                    allowDeselect={true}
                  />
                </View>
                <TouchableOpacity onPress={handleAddRelation} style={styles.addButton}>
                  <Text style={styles.addButtonText}>{t('add')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {activeRelations.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>{noItemsAssignedMessage}</Text>
          ) : (
            <View>{activeRelations.map(renderRelationItem)}</View>
          )}
        </View>
      </CollapsibleCard>
    </View>
  );
};

export default RelationManager;
