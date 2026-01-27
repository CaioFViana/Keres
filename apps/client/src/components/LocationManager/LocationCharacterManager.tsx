import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { CharacterScene } from '@keres/shared/entities/CharacterScene';
import { SceneSelect } from '../../db/schema'; // SceneSelect type
import { CharacterSelect } from '../../db/schemas/characters'; // CharacterSelect type
import { useTheme } from '../../theme';
import GenericRelationDisplay, { BaseRelation, BaseItem } from '../RelationManager/GenericRelationDisplay'; // Import GenericRelationDisplay and Base types

// Define the relation type for GenericRelationDisplay
interface CharacterInLocationRelation extends BaseRelation {
  characterId: string;
  scenes: SceneSelect[]; // Scenes within the current location where this character was present
}

interface LocationCharacterManagerProps {
  currentLocationId: string;
  availableScenes: SceneSelect[];
  characterSceneRelations: CharacterScene[];
  availableCharacters: CharacterSelect[];
}

const LocationCharacterManager: React.FC<LocationCharacterManagerProps> = ({
  currentLocationId,
  availableScenes,
  characterSceneRelations,
  availableCharacters,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    sceneName: {
      fontSize: 14,
      color: colors.textSecondary,
      marginLeft: 10,
    },
  });

  const charactersAsRelations = useMemo(() => {
    // 1. Filter availableScenes to get scenes in the current location
    const scenesInCurrentLocation = availableScenes.filter(
      (scene) => scene.locationId === currentLocationId && !scene.isDeleted
    );

    // 2. Filter characterSceneRelations to get relations for these scenes
    const relationsForCurrentLocationScenes = characterSceneRelations.filter(
      (relation) =>
        scenesInCurrentLocation.some((scene) => scene.id === relation.sceneId) && !relation.isDeleted
    );

    // 3. Group relations by characterId and collect unique scenes for each character
    const groupedByCharacter = new Map<string, { character: CharacterSelect; scenes: SceneSelect[] }>();

    relationsForCurrentLocationScenes.forEach((relation) => {
      const character = availableCharacters.find((char) => char.id === relation.characterId);
      const scene = scenesInCurrentLocation.find((s) => s.id === relation.sceneId);

      if (character && scene) {
        let characterEntry = groupedByCharacter.get(character.id);
        if (!characterEntry) {
          characterEntry = { character, scenes: [] };
          groupedByCharacter.set(character.id, characterEntry);
        }
        // Add scene only if not already present
        if (!characterEntry.scenes.some(s => s.id === scene.id)) {
          characterEntry.scenes.push(scene);
        }
      }
    });

    // 4. Transform into an array of CharacterInLocationRelation objects
    const relations: CharacterInLocationRelation[] = [];
    Array.from(groupedByCharacter.entries())
      .sort(([, a], [, b]) => a.character.name.localeCompare(b.character.name))
      .forEach(([characterId, entry]) => {
        entry.scenes.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        relations.push({
          id: characterId, // Use characterId as the ID for this relation
          characterId: characterId,
          scenes: entry.scenes,
          isDeleted: false, // This relation itself is not "deleted"
        });
      });

    return relations;
  }, [currentLocationId, availableScenes, characterSceneRelations, availableCharacters]);

  const getCharacterById = useCallback((characterId: string) => {
    return availableCharacters.find(char => char.id === characterId);
  }, [availableCharacters]);

  const getCharacterDisplayName = useCallback((character: CharacterSelect) => {
    return character.name;
  }, []);

  const renderCharacterExtraContent = useCallback((relation: CharacterInLocationRelation, relatedCharacter: CharacterSelect) => {
    return (
      <View style={{ flex: 1, paddingVertical: 10 }}>
        <Text style={{ fontSize: 16, color: colors.text }}>{relatedCharacter.name}</Text>
        {relation.scenes.map((scene) => (
          <Text key={scene.id} style={styles.sceneName}>
            - {scene.name}
          </Text>
        ))}
      </View>
    );
  }, [colors.text, colors.textSecondary]);


  return (
    <GenericRelationDisplay<CharacterSelect, CharacterInLocationRelation>
      relations={charactersAsRelations}
      getRelatedItem={getCharacterById}
      getRelationItemId={(relation) => relation.characterId}
      getItemDisplayName={getCharacterDisplayName}
      noItemsMessage={'no_characters_in_location'}
      renderItemExtraContent={renderCharacterExtraContent}
      title={t('characters_in_location_title')}
    />
  );
};

export default LocationCharacterManager;
