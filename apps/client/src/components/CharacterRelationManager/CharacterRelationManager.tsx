import { Ionicons } from '@expo/vector-icons';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import { Character } from '@keres/shared/entities/Character';
import { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { useTheme } from '../../theme';
import { navigateToEntityDetail } from '../../utils/entityNavigation';
import { createULID } from '../../utils/entityUtils';
import { relationSectionStyleDefs } from '../RelationManager/relationSectionStyles';
import Button from '../common/Button/Button';
import CharacterRelationModal from './CharacterRelationModal';
import { AppAlert } from '../../utils/AppAlert';

interface CharacterRelationManagerProps {
  characterRelations: CharacterRelation[];
  characters: Character[];
  onSave: (relation: CharacterRelation) => void;
  onDelete: (relationId: string) => void;
  editable: boolean;
  currentStoryId: string;
  currentCharacterId: string;
}

const CharacterRelationManager: React.FC<CharacterRelationManagerProps> = ({
  characterRelations,
  characters,
  onSave,
  onDelete,
  editable,
  currentStoryId,
  currentCharacterId,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRelation, setEditingRelation] = useState<CharacterRelation | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const getCharacterName = (charId: string) => {
    return characters.find(char => char.id === charId)?.name || `Unknown Character (${charId})`;
  };

  const handleCharacterPress = useCallback((charId: string) => {
    const drawerNavigation = navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>();
    if (drawerNavigation) {
      navigateToEntityDetail(drawerNavigation, 'Character', charId);
    }
  }, [navigation]);

  // Filter relations relevant to the current character
  const filteredRelations = characterRelations.filter(
    rel => rel.charId1 === currentCharacterId || rel.charId2 === currentCharacterId
  );

  const handleAddRelation = () => {
    setEditingRelation(null);
    setIsModalVisible(true);
  };

  const handleEditRelation = (relation: CharacterRelation) => {
    setEditingRelation(relation);
    setIsModalVisible(true);
  };

  const handleDeleteRelation = (relationId: string) => {
    AppAlert.alert(
      t('delete_character_relation_title'),
      t('delete_character_relation_message'),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('delete'),
          onPress: () => onDelete(relationId),
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  const handleModalSave = (
    relatedCharId: string,
    relationType: string,
    idFromModal?: string
  ) => {
    // Order IDs alphabetically to prevent duplicates (A-B vs B-A)
    const [orderedChar1Id, orderedChar2Id] = [currentCharacterId, relatedCharId].sort();

    const newRelation: CharacterRelation = {
      // ALWAYS provide an ID. If editing, use the existing ID. If new, generate a ULID.
      id: idFromModal || createULID(), // Reverted to ensure id is always a string
      storyId: currentStoryId,
      charId1: orderedChar1Id,
      charId2: orderedChar2Id,
      relationType: relationType,
      createdAt: editingRelation?.createdAt || new Date(),
      updatedAt: new Date(),
      version: editingRelation ? editingRelation.version : 1,
      isDeleted: editingRelation ? editingRelation.isDeleted : false,
      deletedAt: editingRelation ? editingRelation.deletedAt : null,
    };
    onSave(newRelation);
    setIsModalVisible(false);
  };

  const styles = StyleSheet.create({
    ...relationSectionStyleDefs(colors),
    relationTextGroup: {
      flex: 1,
    },
    relationTypeText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    buttonContainer: {
      marginBottom: 10,
    },
    noRelationsText: {
      color: colors.textSecondary,
    },
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => setIsCollapsed(!isCollapsed)} style={styles.collapsibleHeader}>
        <Text style={styles.collapsibleHeaderText}>{t('character_relations_title')}</Text>
        <Ionicons name={isCollapsed ? 'chevron-down-outline' : 'chevron-up-outline'} size={24} color={colors.text} />
      </TouchableOpacity>

      {!isCollapsed && (
        <View style={styles.collapsibleContent}>
          {editable && (
            <View style={styles.buttonContainer}>
              <Button onPress={handleAddRelation}>
                {t('add_character_relation')}
              </Button>
            </View>
          )}

          {filteredRelations.length === 0 ? (
            <Text style={styles.noRelationsText}>{t('no_character_relations_found')}</Text>
          ) : (
            <View>
              {filteredRelations.map((item) => {
                const relatedChar = item.charId1 === currentCharacterId ? item.charId2 : item.charId1;
                return (
                  <View key={item.id} style={styles.relationItem}>
                    <TouchableOpacity
                      style={styles.relationTextGroup}
                      onPress={() => handleCharacterPress(relatedChar)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.relationText}>{getCharacterName(relatedChar)}</Text>
                      <Text style={styles.relationTypeText}>{item.relationType}</Text>
                    </TouchableOpacity>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} style={{ marginHorizontal: 4 }} />
                    {editable && (
                      <View style={styles.actionsRow}>
                        <TouchableOpacity onPress={() => handleEditRelation(item)}>
                          <Ionicons name="create-outline" size={22} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteRelation(item.id)}>
                          <Ionicons name="trash-outline" size={22} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      <CharacterRelationModal
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSave={handleModalSave}
        initialRelation={editingRelation}
        characters={characters}
        currentStoryId={currentStoryId}
        currentCharacterId={currentCharacterId}
      />
    </View>
  );
};

export default CharacterRelationManager;
