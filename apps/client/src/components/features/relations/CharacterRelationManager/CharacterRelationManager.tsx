import { Ionicons } from '@expo/vector-icons';
import { getEntityAppearance } from '@keres/shared';
import type { Character } from '@keres/shared/entities/Character';
import type { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';
import { useNavigateToEntityDetail } from '../../../../hooks/useNavigateToEntityDetail';
import { createULID } from '../../../../utils/entityUtils';
import { relationSectionStyleDefs } from '@/src/components/features/relations/RelationManager/relationSectionStyles';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import EntityRelationList from '@/src/components/common/display/EntityRelationList/EntityRelationList';
import Button from '@/src/components/common/controls/Button/Button';
import CharacterRelationModal from '@/src/components/features/relations/CharacterRelationManager/CharacterRelationModal';
import { AppAlert } from '../../../../utils/AppAlert';

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
  const navigateToDetail = useNavigateToEntityDetail();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRelation, setEditingRelation] = useState<CharacterRelation | null>(null);

  const getCharacterName = (charId: string) => {
    return characters.find((char) => char.id === charId)?.name || `Unknown Character (${charId})`;
  };

  const handleCharacterPress = useCallback(
    (charId: string) => {
      navigateToDetail('Character', charId);
    },
    [navigateToDetail],
  );

  // Filter relations relevant to the current character
  const filteredRelations = characterRelations.filter(
    (rel) => rel.character1Id === currentCharacterId || rel.character2Id === currentCharacterId,
  );

  // Characters already related to this one - excluded from the "add" picker so a second
  // relation for the same pair can't be created (the modal only excludes self otherwise).
  const relatedCharacterIds = filteredRelations.map((rel) =>
    rel.character1Id === currentCharacterId ? rel.character2Id : rel.character1Id,
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
      { cancelable: true },
    );
  };

  const handleModalSave = (relatedCharId: string, relationType: string, idFromModal?: string) => {
    // Order IDs alphabetically to prevent duplicates (A-B vs B-A)
    const [orderedChar1Id, orderedChar2Id] = [currentCharacterId, relatedCharId].sort();

    const newRelation: CharacterRelation = {
      // ALWAYS provide an ID. If editing, use the existing ID. If new, generate a ULID.
      id: idFromModal || createULID(), // Reverted to ensure id is always a string
      storyId: currentStoryId,
      character1Id: orderedChar1Id,
      character2Id: orderedChar2Id,
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
    relationTypeText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
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
      <CollapsibleCard title={t('character_relations_title')} initialExpanded={false}>
        <View>
          {editable && (
            <View style={styles.buttonContainer}>
              <Button onPress={handleAddRelation}>{t('add_character_relation')}</Button>
            </View>
          )}

          <EntityRelationList
            emptyText={t('no_character_relations_found')}
            items={filteredRelations.map((relation) => {
              const relatedId =
                relation.character1Id === currentCharacterId
                  ? relation.character2Id
                  : relation.character1Id;
              return {
                id: relation.id,
                title: getCharacterName(relatedId),
                icon: 'people',
                color: getEntityAppearance('Character').color,
                details: <Text style={styles.relationTypeText}>{relation.relationType}</Text>,
                onPress: editable ? undefined : () => handleCharacterPress(relatedId),
                trailing: editable ? (
                  <View style={{ flexDirection: 'row', gap: 10, marginLeft: 8 }}>
                    <TouchableOpacity onPress={() => handleEditRelation(relation)}>
                      <Ionicons name="create-outline" size={22} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteRelation(relation.id)}>
                      <Ionicons name="trash-outline" size={22} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ) : undefined,
              };
            })}
          />
        </View>
      </CollapsibleCard>

      <CharacterRelationModal
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSave={handleModalSave}
        initialRelation={editingRelation}
        characters={characters}
        currentStoryId={currentStoryId}
        currentCharacterId={currentCharacterId}
        relatedCharacterIds={relatedCharacterIds}
      />
    </View>
  );
};

export default CharacterRelationManager;
