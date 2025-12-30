import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'; // Removed FlatList
import { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import { Character } from '@keres/shared/entities/Character';
import { useTheme } from '../../theme';
import Button from '../common/Button/Button';
import CharacterRelationModal from './CharacterRelationModal';
import { useTranslation } from 'react-i18next';
import { createULID } from '../../utils/ulid';
import { Ionicons } from '@expo/vector-icons';

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

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRelation, setEditingRelation] = useState<CharacterRelation | null>(null);

  const getCharacterName = (charId: string) => {
    return characters.find(char => char.id === charId)?.name || `Unknown Character (${charId})`;
  };

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
    Alert.alert(
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
    container: {
      flex: 1,
      padding: 10,
    },
    headerRow: {
      flexDirection: 'row',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    row: {
      flexDirection: 'row',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      alignItems: 'center',
    },
    cell: {
      flex: 1,
      paddingHorizontal: 5,
      color: colors.text,
    },
    headerCell: {
      fontWeight: 'bold',
      color: colors.text,
    },
    actionsCell: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: 100, // Fixed width for action buttons
    },
    buttonContainer: {
      marginBottom: 10,
    },
    noRelationsText: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 20,
    },
  });

  return (
    <View style={styles.container}>
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
          <View style={styles.headerRow}>
            <Text style={[styles.cell, styles.headerCell]}>{t('related_character')}</Text>
            <Text style={[styles.cell, styles.headerCell]}>{t('relation_type')}</Text>
            {editable && <Text style={styles.actionsCell}></Text>}
          </View>
          {filteredRelations.map((item) => { // Replaced FlatList with map
            const relatedChar = item.charId1 === currentCharacterId ? item.charId2 : item.charId1;
            return (
              <View key={item.id} style={styles.row}>
                <Text style={styles.cell}>{getCharacterName(relatedChar)}</Text>
                <Text style={styles.cell}>{item.relationType}</Text>
                {editable && (
                  <View style={styles.actionsCell}>
                    <TouchableOpacity onPress={() => handleEditRelation(item)}>
                      <Ionicons name="create-outline" size={24} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteRelation(item.id)}>
                      <Ionicons name="trash-outline" size={24} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
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