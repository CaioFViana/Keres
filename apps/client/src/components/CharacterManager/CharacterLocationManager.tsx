import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { CharacterScene } from '@keres/shared/entities/CharacterScene';
import { SceneSelect } from '../../db/schema';
import { Location } from '@keres/shared/entities/Location';
import { useTheme } from '../../theme';
import GenericRelationDisplay, { BaseRelation } from '../RelationManager/GenericRelationDisplay'; // Import GenericRelationDisplay and Base types

// Define the relation type for GenericRelationDisplay
interface CharacterLocationRelation extends BaseRelation {
  locationId: string;
  scenes: SceneSelect[]; // Scenes where the current character was present at this location
}

interface CharacterLocationManagerProps {
  characterSceneRelations: CharacterScene[];
  availableScenes: SceneSelect[];
  availableLocations: Location[];
  currentCharacterId: string;
}

const CharacterLocationManager: React.FC<CharacterLocationManagerProps> = ({
  characterSceneRelations,
  availableScenes,
  availableLocations,
  currentCharacterId,
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

  const locationsAsRelations = useMemo(() => {
    const relevantCharacterScenes = characterSceneRelations.filter(
      (relation) => relation.characterId === currentCharacterId && !relation.isDeleted
    );

    const scenesRelevantToCharacter = relevantCharacterScenes
      .map((relation) => availableScenes.find((scene) => scene.id === relation.sceneId))
      .filter((scene): scene is SceneSelect => scene !== undefined && !scene.isDeleted);

    const groupedByLocation = new Map<string, { location: Location; scenes: SceneSelect[] }>();

    scenesRelevantToCharacter.forEach((scene) => {
      if (scene.locationId) {
        let locationEntry = groupedByLocation.get(scene.locationId);
        if (!locationEntry) {
          const location = availableLocations.find((loc) => loc.id === scene.locationId);
          if (location) {
            locationEntry = { location, scenes: [] };
            groupedByLocation.set(scene.locationId, locationEntry);
          }
        }
        locationEntry?.scenes.push(scene);
      }
    });

    // Sort scenes within each location by name and then locations by name
    const relations: CharacterLocationRelation[] = [];
    Array.from(groupedByLocation.entries()).sort(([, a], [, b]) => a.location.name.localeCompare(b.location.name)).forEach(([locationId, entry]) => {
      entry.scenes.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      relations.push({
        id: locationId, // Use locationId as the ID for this relation
        locationId: locationId,
        scenes: entry.scenes,
        isDeleted: false, // This relation itself is not "deleted"
      });
    });

    return relations;
  }, [characterSceneRelations, availableScenes, availableLocations, currentCharacterId]);

  const getLocationById = useCallback((locationId: string) => {
    return availableLocations.find(loc => loc.id === locationId);
  }, [availableLocations]);

  const getLocationDisplayName = useCallback((location: Location) => {
    return location.name;
  }, []);

  const renderLocationExtraContent = useCallback((relation: CharacterLocationRelation, relatedLocation: Location) => {
    return (
      <View style={{ flex: 1, paddingVertical: 10 }}>
        <Text style={{ fontSize: 16, color: colors.text }}>{relatedLocation.name}</Text>
        {relation.scenes.map((scene) => (
          <Text key={scene.id} style={styles.sceneName}>
            - {scene.name}
          </Text>
        ))}
      </View>
    );
  }, [colors.text, styles.sceneName]);


  return (
    <GenericRelationDisplay<Location, CharacterLocationRelation>
      relations={locationsAsRelations}
      getRelatedItem={getLocationById}
      getRelationItemId={(relation) => relation.locationId}
      getItemDisplayName={getLocationDisplayName}
      noItemsMessage={'no_locations_assigned_to_character'}
      renderItemExtraContent={renderLocationExtraContent}
      title={t('character_locations_title')}
    />
  );
};

export default CharacterLocationManager;