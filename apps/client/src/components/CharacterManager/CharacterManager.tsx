import { Ionicons } from '@expo/vector-icons';
import { Character } from '@keres/shared/entities/Character';
import { CharacterScene } from '@keres/shared/entities/CharacterScene';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Select from '../common/Select/Select';
import { useTheme } from '../../theme';
import { createULID } from '../../utils/ulid';

type SelectOption = { label: string; value: string; color?: string };

interface CharacterManagerProps {
  characterRelations: CharacterScene[];
  availableCharacters: Character[]; // All available characters to choose from
  onSave: (relation: CharacterScene) => Promise<void>;
  onDelete: (relationId: string) => Promise<void>;
  editable: boolean;
  currentStoryId: string;
  currentEntityId: string; // The ID of the scene this character is related to
  currentEntityType: 'Scene'; // For now, only 'Scene' for CharacterScene
}

const CharacterManager: React.FC<CharacterManagerProps> = ({
  characterRelations,
  availableCharacters,
  onSave,
  onDelete,
  editable,
  currentStoryId,
  currentEntityId,
  currentEntityType,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [selectedCharacterIdToAdd, setSelectedCharacterIdToAdd] = useState<string | null>(null);

  const styles = StyleSheet.create({
    container: {
      marginTop: 10,
    },
    relationItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 15,
      backgroundColor: colors.surface,
      borderRadius: 8,
      marginBottom: 8,
    },
    relationText: {
      fontSize: 16,
      color: colors.text,
      flex: 1,
    },
    deleteButton: {
      marginLeft: 10,
      padding: 5,
    },
    addRelationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 15,
      marginBottom: 10,
    },
    dropdown: {
      flex: 1,
      marginRight: 10,
      zIndex: 2, // Ensure dropdown is above other elements
    },
    addButton: {
      padding: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    addButtonText: {
      color: colors.onPrimary,
      fontWeight: 'bold',
    },
  });

  const handleAddCharacterRelation = useCallback(async () => {
    if (!selectedCharacterIdToAdd) {
      Alert.alert(t('error'), t('select_character_to_add'));
      return;
    }

    const characterExists = characterRelations.some(rel => rel.characterId === selectedCharacterIdToAdd);
    if (characterExists) {
      Alert.alert(t('error'), t('character_already_added_to_scene'));
      return;
    }

    const newRelation: CharacterScene = {
      id: createULID(),
      storyId: currentStoryId,
      characterId: selectedCharacterIdToAdd,
      sceneId: currentEntityId, // The currentEntityId is the sceneId in this context
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
    };

    await onSave(newRelation);
    setSelectedCharacterIdToAdd(null);
  }, [selectedCharacterIdToAdd, characterRelations, currentStoryId, currentEntityId, onSave, t]);

  const handleDeleteCharacterRelation = useCallback(async (relationId: string) => {
    Alert.alert(
      t('delete_character_from_scene_title'),
      t('delete_character_from_scene_message'),
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
  }, [onDelete, t]);

  const availableCharacterOptions: SelectOption[] = availableCharacters
    .filter(char => !char.isDeleted && !characterRelations.some(rel => rel.characterId === char.id))
    .map(char => ({
      label: char.name,
      value: char.id,
    }));

  const renderCharacterRelationItem = (item: CharacterScene) => {
    const character = availableCharacters.find(c => c.id === item.characterId);
    if (!character) return null;

    return (
      <View key={item.id} style={styles.relationItem}>
        <Text style={styles.relationText}>{character.name}</Text>
        {editable && (
          <TouchableOpacity onPress={() => handleDeleteCharacterRelation(item.id)} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={24} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {characterRelations.length === 0 ? (
        <Text style={{ color: colors.textSecondary }}>{t('no_characters_assigned')}</Text>
      ) : (
        <View>
          {characterRelations.map(renderCharacterRelationItem)}
        </View>
      )}

      {editable && (
        <View style={styles.addRelationContainer}>
          <View style={styles.dropdown}>
            <Select
              options={availableCharacterOptions}
              value={selectedCharacterIdToAdd}
              onValueChange={(value: string | null) => setSelectedCharacterIdToAdd(value)}
              placeholder={t('select_character')}
              multiple={false}
              allowDeselect={true}
            />
          </View>
          <TouchableOpacity onPress={handleAddCharacterRelation} style={styles.addButton}>
            <Text style={styles.addButtonText}>{t('add')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default CharacterManager;