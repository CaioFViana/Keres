import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';
import Select from '@/src/components/common/inputs/Select/Select';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput'; // Import TextInput
import { relationSectionStyleDefs } from '@/src/components/features/relations/RelationManager/relationSectionStyles';
import { AppAlert } from '../../../../utils/AppAlert';

// Generic types for items and relations
export type BaseItem = { id: string; isDeleted: boolean; };
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
  createRelationObject: (selectedItemId: string, storyId: string, currentEntityId: string) => TRelation;
  getRelationItemId: (relation: TRelation) => string; // Returns the ID of the TItem in the TRelation
  getItemDisplayName: (item: TItem) => string; // Returns the name/title of the TItem for display
  getItemSearchValue: (item: TItem) => string; // Returns the value of the TItem for searching
  filterAvailableItems: (item: TItem, relations: TRelation[], getRelationItemId: (relation: TRelation) => string) => boolean;
  selectItemPlaceholder: string;
  noItemsAssignedMessage: string;
  itemAlreadyAddedMessage: string;
  selectItemToAddMessage: string;
  deleteConfirmationTitle: string;
  deleteConfirmationMessage: string;
  renderRelationItemExtraContent?: (relation: TRelation, availableItems: TItem[]) => React.ReactNode;
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
  const [isCollapsed, setIsCollapsed] = useState(true); // Add isCollapsed state, default to true

  const styles = StyleSheet.create({
    ...relationSectionStyleDefs(colors),
    deleteButton: {
      marginLeft: 10,
      padding: 5,
    },
    addRelationContainer: {
      // flexDirection: 'row', // Removed flexDirection here, will manage with flexGrow on Select
      alignItems: 'center',
      marginTop: 15,
      marginBottom: 10,
    },
    dropdown: {
      flex: 1, // Allow Select to grow
      marginRight: 10,
      zIndex: 2,
    },
    addButton: {
      paddingHorizontal: 10,
      paddingVertical: 16,
      borderRadius: 5,
      backgroundColor: colors.primary,
      alignSelf: 'flex-start', // Align button to start
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
  });

  const handleAddRelation = useCallback(async () => {
    if (!selectedItemIdToAdd) {
      AppAlert.alert(t('error'), selectItemToAddMessage);
      return;
    }

    // Check for duplicates using the generic getRelationItemId
    const itemExists = relations.some(rel => getRelationItemId(rel) === selectedItemIdToAdd);
    if (itemExists) {
      AppAlert.alert(t('error'), itemAlreadyAddedMessage);
      return;
    }

    const newRelation = createRelationObject(selectedItemIdToAdd, currentStoryId, currentEntityId);

    await onSave(newRelation);
    setSelectedItemIdToAdd(null);
    setSearchTerm(''); // Clear search term after adding
  }, [selectedItemIdToAdd, relations, currentStoryId, currentEntityId, createRelationObject, getRelationItemId, onSave, t, selectItemToAddMessage, itemAlreadyAddedMessage]);

  const handleDeleteRelation = useCallback(async (relationId: string) => {
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
      { cancelable: true }
    );
  }, [onDelete, t, deleteConfirmationTitle, deleteConfirmationMessage]);

  const filteredAvailableItems = availableItems
    .filter(item => filterAvailableItems(item, relations, getRelationItemId))
    .filter(item => getItemSearchValue(item).toLowerCase().includes(searchTerm.toLowerCase()));

  const availableItemOptions = filteredAvailableItems.map(item => ({
      label: getItemDisplayName(item),
      value: item.id,
  }));

  const renderRelationItem = (relation: TRelation) => {
    const relatedItem = availableItems.find(item => item.id === getRelationItemId(relation));
    if (!relatedItem) return null;

    const content = renderRelationItemExtraContent ? (
      renderRelationItemExtraContent(relation, availableItems)
    ) : (
      <Text style={styles.relationText}>{getItemDisplayName(relatedItem)}</Text>
    );

    return (
      <View key={relation.id} style={styles.relationItem}>
        {onItemPress ? (
          <TouchableOpacity style={styles.relationItemContent} onPress={() => onItemPress(relatedItem)} activeOpacity={0.7}>
            {content}
          </TouchableOpacity>
        ) : (
          <View style={styles.relationItemContent}>{content}</View>
        )}
        {onItemPress && !editable && (
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} style={styles.chevron} />
        )}
        {editable && (
          <TouchableOpacity onPress={() => handleDeleteRelation(relation.id)} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={24} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => setIsCollapsed(!isCollapsed)} style={styles.collapsibleHeader}>
        <Text style={styles.collapsibleHeaderText}>{title}</Text>
        <Ionicons name={isCollapsed ? 'chevron-down-outline' : 'chevron-up-outline'} size={24} color={colors.text} />
      </TouchableOpacity>

      {!isCollapsed && (
        <View style={styles.collapsibleContent}>
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

          {relations.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>{noItemsAssignedMessage}</Text>
          ) : (
            <View>
              {relations.map(renderRelationItem)}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default RelationManager;