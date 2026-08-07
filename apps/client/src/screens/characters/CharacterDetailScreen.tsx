import { Ionicons } from '@expo/vector-icons';
import { CharacterRelation } from '@keres/shared/entities/CharacterRelation'; // Import CharacterRelation
import { CharacterScene } from '@keres/shared/entities/CharacterScene'; // Entity type
import { Item, ItemJourney } from '@keres/shared/entities/Item'; // Import Item and ItemJourney entities
import { Location } from '@keres/shared/entities/Location'; // Import Location entity
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CharacterLocationManager from '../../components/CharacterManager/CharacterLocationManager'; // Import CharacterLocationManager
import CharacterSceneManager from '../../components/CharacterManager/CharacterSceneManager'; // The manager component
import CharacterRelationManager from '../../components/CharacterRelationManager/CharacterRelationManager'; // Import CharacterRelationManager
import CustomAttributeDetailFields from '../../components/common/CustomAttributeFields/CustomAttributeDetailFields';
import DetailField from '../../components/common/DetailField/DetailField';
import EntityMetadata from '../../components/common/EntityMetadata/EntityMetadata';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import TagChipList from '../../components/common/TagChipList/TagChipList';
import EntityGalleryManager from '../../components/GalleryManager/EntityGalleryManager';
import ItemCharacterManager from '../../components/ItemManager/ItemCharacterManager'; // Import ItemCharacterManager
import NoteManager from '../../components/NoteManager'; // Import NoteManager
import { useDrizzle } from '../../db';
import { SceneSelect } from '../../db/schema'; // For available scenes
import { CharacterSelect } from '../../db/schemas/characters';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useOpenGalleryMediaViewer } from '../../hooks/useOpenGalleryMediaViewer';
import { useStoryRole } from '../../hooks/useStoryRole';
import { CharacterRelationServiceInterface, createCharacterRelationService } from '../../services/storymanagement/CharacterRelationService'; // Import CharacterRelationService
import { CharacterSceneServiceInterface, createCharacterSceneService } from '../../services/storymanagement/CharacterSceneService'; // Service for CharacterScene
import { createCharacterService } from '../../services/storymanagement/CharacterService';
import { createItemJourneyService, ItemJourneyService } from '../../services/storymanagement/ItemJourneyService'; // Import ItemJourneyService
import { createItemService, ItemService } from '../../services/storymanagement/ItemService'; // Import ItemService
import { createLocationService, LocationService } from '../../services/storymanagement/LocationService'; // Import LocationService
import { createSceneService } from '../../services/storymanagement/SceneService';
import { useUserSettingsStore } from '../../state/userSettingsStore'; // Import useUserSettingsStore
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { setDocumentTitle } from '../../utils/documentTitle';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { type CharactersScreenNavigationProp } from './CharacterListScreen';
import { AppAlert } from '../../utils/AppAlert';

// Define the parameter list for this screen
export type CharacterDetailScreenParamList = {
  CharacterDetail: { characterId: string };
};

type CharacterDetailScreenRouteProp = RouteProp<CharacterDetailScreenParamList, 'CharacterDetail'>;

const CharacterDetailScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<CharactersScreenNavigationProp>();
  const openGalleryMediaViewer = useOpenGalleryMediaViewer();
  const route = useRoute<CharacterDetailScreenRouteProp>();
  const { characterId } = route.params;
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore(); // Get userId from store
  const scrollBottomPadding = useFormScrollBottomPadding();

  const drizzleDb = useDrizzle();
  const characterServiceRef = useRef<ReturnType<typeof createCharacterService> | null>(null);
  const characterRelationServiceRef = useRef<CharacterRelationServiceInterface | null>(null); // Ref for CharacterRelationService
  const characterSceneServiceRef = useRef<CharacterSceneServiceInterface | null>(null); // Ref for CharacterSceneService
  const itemServiceRef = useRef<ItemService | null>(null); // Ref for ItemService
  const itemJourneyServiceRef = useRef<ItemJourneyService | null>(null); // Ref for ItemJourneyService
  const locationServiceRef = useRef<LocationService | null>(null); // Ref for LocationService

  // Initialize services once when drizzleDb is available
  useEffect(() => {
    if (drizzleDb) {
      if (!characterServiceRef.current) {
        characterServiceRef.current = createCharacterService(drizzleDb);
      }
      if (!characterRelationServiceRef.current) {
        characterRelationServiceRef.current = createCharacterRelationService(drizzleDb);
      }
      if (!characterSceneServiceRef.current) {
        characterSceneServiceRef.current = createCharacterSceneService(drizzleDb);
      }
      if (!itemServiceRef.current) {
        itemServiceRef.current = createItemService(drizzleDb);
      }
      if (!itemJourneyServiceRef.current) {
        itemJourneyServiceRef.current = createItemJourneyService(drizzleDb);
      }
      if (!locationServiceRef.current) {
        locationServiceRef.current = createLocationService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  const [character, setCharacter] = useState<CharacterSelect | null>(null);
  const { canEdit } = useStoryRole(character?.storyId);
  const [characterRelations, setCharacterRelations] = useState<CharacterRelation[]>([]); // State for relations
  const [allCharacters, setAllCharacters] = useState<CharacterSelect[]>([]); // State for all characters in story

  const {
    selectedTags: characterTags,
    allNotes,
    noteRelations: characterNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Character', entityId: characterId });
  const [allScenes, setAllScenes] = useState<SceneSelect[]>([]); // State for all scenes in story
  const [characterSceneRelations, setCharacterSceneRelations] = useState<CharacterScene[]>([]); // State for character scene relations
  const [allItems, setAllItems] = useState<Item[]>([]); // State for all items in story
  const [allItemJourneys, setAllItemJourneys] = useState<ItemJourney[]>([]); // State for all item journeys in story
  const [allLocations, setAllLocations] = useState<Location[]>([]); // State for all locations in story
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  // Move styles declaration to the top
  const commonContainerStyles = getCommonContainerStyles(colors);
  const styles = StyleSheet.create({
    mainTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 5,
    },
    subTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 15,
    },
    buttonContainer: {
      marginTop: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 15,
      marginBottom: 5,
    },
  });

  const fetchCharacter = useCallback(async () => {
    if (!characterServiceRef.current) {
      console.warn('Character service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedCharacter = await characterServiceRef.current.getById(characterId);
      if (fetchedCharacter && !fetchedCharacter.isDeleted) {
        setCharacter(fetchedCharacter);
        setHeaderTitle(fetchedCharacter.name || t('character_details_title'));
      } else if (fetchedCharacter && fetchedCharacter.isDeleted) {
        navigation.goBack();
      } else {
        setError(t('character_not_found'));
        setHeaderTitle(t('character_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch character details:', err);
      setError(t('failed_to_load_character'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [characterId, setCharacter, setLoading, setError, setHeaderTitle, navigation, t]);

  const fetchRelationsForCharacter = useCallback(async () => {
    if (!characterRelationServiceRef.current || !character?.storyId || !characterId) {
      setCharacterRelations([]);
      return;
    }
    try {
      const fetchedRelations = await characterRelationServiceRef.current.getRelationsForCharacter(character.storyId, characterId);
      setCharacterRelations(fetchedRelations);
    } catch (err) {
      console.error('Failed to fetch character relations:', err);
    }
  }, [character?.storyId, characterId]);

  const fetchAllCharactersInStory = useCallback(async () => {
    if (!characterServiceRef.current || !character?.storyId) {
      setAllCharacters([]);
      return;
    }
    try {
      const fetchedCharacters = await characterServiceRef.current.getAllByStoryId(character.storyId);
      setAllCharacters(fetchedCharacters.filter(c => !c.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all characters:', err);
    }
  }, [character?.storyId]);

  const fetchScenesForCharacter = useCallback(async () => {
    if (!characterSceneServiceRef.current || !character?.storyId || !characterId) {
      setCharacterSceneRelations([]);
      return;
    }
    try {
      const fetchedRelations = await characterSceneServiceRef.current.getRelationsForCharacter(character.storyId, characterId);
      setCharacterSceneRelations(fetchedRelations);
    } catch (err) {
      console.error('Failed to fetch character scene relations:', err);
    }
  }, [character?.storyId, characterId]);

  const fetchAllScenesInStory = useCallback(async () => {
    if (!drizzleDb || !character?.storyId) {
      setAllScenes([]);
      return;
    }
    try {
      const sceneService = createSceneService(drizzleDb);
      const fetchedScenes = await sceneService.getScenesByStoryId(character.storyId);
      setAllScenes(fetchedScenes.filter(s => !s.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all scenes:', err);
    }
  }, [character?.storyId, drizzleDb]);

  const fetchAllItemsInStory = useCallback(async () => {
    if (!itemServiceRef.current || !character?.storyId) {
      setAllItems([]);
      return;
    }
    try {
      const fetchedItems = await itemServiceRef.current.getAllByStoryId(character.storyId);
      setAllItems(fetchedItems.filter(i => !i.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all items:', err);
    }
  }, [character?.storyId]);

  const fetchAllItemJourneysInStory = useCallback(async () => {
    if (!itemJourneyServiceRef.current || !character?.storyId) {
      setAllItemJourneys([]);
      return;
    }
    try {
      const fetchedItemJourneys = await itemJourneyServiceRef.current.getAllByStoryId(character.storyId);
      setAllItemJourneys(fetchedItemJourneys.filter(ij => !ij.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all item journeys:', err);
    }
  }, [character?.storyId]);

  const fetchAllLocationsInStory = useCallback(async () => {
    if (!locationServiceRef.current || !character?.storyId) {
      setAllLocations([]);
      return;
    }
    try {
      const fetchedLocations = await locationServiceRef.current.getAllByStoryId(character.storyId);
      setAllLocations(fetchedLocations.filter(l => !l.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all locations:', err);
    }
  }, [character?.storyId]);

  const handleCharacterChange = useCallback(async (changedStoryId: string, changedCharacterId: string) => {
    if (changedCharacterId === characterId) {
      if (characterServiceRef.current) {
        const updatedCharacter = await characterServiceRef.current.getById(characterId);
        if (!updatedCharacter || updatedCharacter.isDeleted) {
          navigation.goBack();
        } else {
          setCharacter(updatedCharacter);
          setHeaderTitle(updatedCharacter.name || t('character_details_title'));
        }
      }
    }
  }, [characterId, navigation, setCharacter, setHeaderTitle, t]);

  const handleCharacterRelationChange = useCallback((changedStoryId: string, changedCharacterId: string) => {
    if (changedCharacterId === characterId) {
      fetchRelationsForCharacter();
    }
  }, [characterId, fetchRelationsForCharacter]);

  const handleCharacterSceneChange = useCallback((changedStoryId: string, changedCharacterId: string) => {
    if (changedCharacterId === characterId) {
      fetchScenesForCharacter();
    }
  }, [characterId, fetchScenesForCharacter]);

  const handleItemChange = useCallback((changedStoryId: string, changedItemId: string) => {
    if (character?.storyId === changedStoryId) {
      fetchAllItemsInStory();
    }
  }, [character?.storyId, fetchAllItemsInStory]);

  const handleItemJourneyChange = useCallback((changedStoryId: string, changedItemJourneyId: string) => {
    if (character?.storyId === changedStoryId) {
      fetchAllItemJourneysInStory();
    }
  }, [character?.storyId, fetchAllItemJourneysInStory]);

  const handleLocationChange = useCallback((changedStoryId: string, changedLocationId: string) => {
    if (character?.storyId === changedStoryId) {
      fetchAllLocationsInStory();
    }
  }, [character?.storyId, fetchAllLocationsInStory]);

  // Notes, note relations and tags are kept fresh by useEntityRelations.
  useEffect(() => {
    if (characterServiceRef.current) {
      fetchCharacter();
      entityEventEmitter.on('character_changed', handleCharacterChange);
      entityEventEmitter.on('character_relation_changed', handleCharacterRelationChange); // Listen for character relation changes
      entityEventEmitter.on('character_scene_changed', handleCharacterSceneChange); // Listen for character scene changes
      entityEventEmitter.on('item_changed', handleItemChange); // Listen for item changes
      entityEventEmitter.on('item_journey_changed', handleItemJourneyChange); // Listen for item journey changes
      entityEventEmitter.on('location_changed', handleLocationChange); // Listen for location changes

      return () => {
        entityEventEmitter.off('character_changed', handleCharacterChange);
        entityEventEmitter.off('character_relation_changed', handleCharacterRelationChange);
        entityEventEmitter.off('character_scene_changed', handleCharacterSceneChange); // Remove this listener
        entityEventEmitter.off('item_changed', handleItemChange);
        entityEventEmitter.off('item_journey_changed', handleItemJourneyChange);
        entityEventEmitter.off('location_changed', handleLocationChange);
      };
    }
  }, [characterId, fetchCharacter, handleCharacterChange, handleCharacterRelationChange,
    handleCharacterSceneChange, handleItemChange, handleItemJourneyChange, handleLocationChange]);

  useEffect(() => {
    if (character) {
      fetchRelationsForCharacter();
      fetchAllCharactersInStory(); // Fetch all characters here
      fetchScenesForCharacter(); // Fetch character scene relations
      fetchAllScenesInStory(); // Fetch all scenes
      fetchAllItemsInStory(); // Fetch all items
      fetchAllItemJourneysInStory(); // Fetch all item journeys
      fetchAllLocationsInStory(); // Fetch all locations
    }
  }, [character, fetchRelationsForCharacter, fetchAllCharactersInStory, fetchScenesForCharacter, fetchAllScenesInStory, fetchAllItemsInStory, fetchAllItemJourneysInStory, fetchAllLocationsInStory]);

  const handleSaveRelation = async (relation: CharacterRelation) => {
    if (!characterRelationServiceRef.current || !character?.storyId || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedRelation = await characterRelationServiceRef.current.saveCharacterRelation(userId, relation);
      // Update local state and emit event
      setCharacterRelations(prev => {
        const existingIndex = prev.findIndex(r => r.id === savedRelation.id);
        if (existingIndex > -1) {
          return prev.map((r, index) => (index === existingIndex ? savedRelation : r));
        } else {
          return [...prev, savedRelation];
        }
      });
      entityEventEmitter.emit('character_relation_changed', character?.storyId, characterId);
      AppAlert.alert(t('success'), t('relation_saved_successfully'));
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_save_relation'));
      console.error('Failed to save character relation:', error);
    }
  };

  const handleDeleteRelation = async (relationId: string) => {
    if (!characterRelationServiceRef.current || !character?.storyId || !userId) { // Added !userId check
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await characterRelationServiceRef.current.deleteCharacterRelation(userId, relationId); // Pass userId
      if (success) {
        setCharacterRelations(prev => prev.filter(r => r.id !== relationId));
        entityEventEmitter.emit('character_relation_changed', character?.storyId, characterId);
        AppAlert.alert(t('success'), t('relation_deleted_successfully'));
      } else {
        AppAlert.alert(t('error'), t('failed_to_delete_relation'));
      }
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_delete_relation'));
      console.error('Failed to delete character relation:', error);
    }
  };

  const handleSaveCharacterScene = async (characterScene: CharacterScene) => {
    if (!characterSceneServiceRef.current || !character?.storyId || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedCharacterScene = await characterSceneServiceRef.current.saveCharacterScene(userId, characterScene);
      setCharacterSceneRelations(prev => {
        const existingIndex = prev.findIndex(cs => cs.id === savedCharacterScene.id);
        if (existingIndex > -1) {
          return prev.map((cs, index) => (index === existingIndex ? savedCharacterScene : cs));
        } else {
          return [...prev, savedCharacterScene];
        }
      });
      entityEventEmitter.emit('character_scene_changed', character?.storyId, characterId);
      AppAlert.alert(t('success'), t('character_scene_saved_successfully'));
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_save_character_scene'));
      console.error('Failed to save character scene:', error);
    }
  };

  const handleDeleteCharacterScene = async (characterSceneId: string) => {
    if (!characterSceneServiceRef.current || !character?.storyId || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await characterSceneServiceRef.current.deleteCharacterScene(userId, characterSceneId);
      if (success) {
        setCharacterSceneRelations(prev => prev.filter(cs => cs.id !== characterSceneId));
        entityEventEmitter.emit('character_scene_changed', character?.storyId, characterId);
        AppAlert.alert(t('success'), t('character_scene_deleted_successfully'));
      } else {
        AppAlert.alert(t('error'), t('failed_to_delete_character_scene'));
      }
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_delete_character_scene'));
      console.error('Failed to delete character scene:', error);
    }
  };


  const renderHeaderRight = useCallback(() => (
    canEdit ? (
      <TouchableOpacity
        onPress={() => navigation.navigate('CharacterForm', { characterId: characterId })}
        style={{ marginRight: 15 }}
      >
        <Ionicons name="pencil-outline" size={24} color={colors.text} />
      </TouchableOpacity>
    ) : null
  ), [navigation, characterId, colors.text, canEdit]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: headerTitle,
        headerRight: renderHeaderRight,
      });
      setDocumentTitle(headerTitle);
    }, [navigation, headerTitle, renderHeaderRight])
  );

  if (loading) {
    return <ScreenLoading padded message={t('loading_character_details')} />;
  }

  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }

  if (!character) {
    return <ScreenError padded message={t('character_data_missing')} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <ScrollView style={commonContainerStyles.container} contentContainerStyle={{ paddingBottom: scrollBottomPadding }}>
      {character.title && <Text style={styles.subTitle}>{character.title}</Text>}
      <TagChipList tags={characterTags} />

      <DetailField label={t('gender')} value={character.gender || t('common_na')} />
      <DetailField label={t('race')} value={character.race || t('common_na')} />
      {character.subrace && <DetailField label={t('subrace')} value={character.subrace} />}
      <DetailField label={t('description')} value={character.description || t('common_na')} />
      <DetailField label={t('personality')} value={character.personality || t('common_na')} />
      <DetailField label={t('motivation')} value={character.motivation || t('common_na')} />
      <DetailField label={t('qualities')} value={character.qualities || t('common_na')} />
      <DetailField label={t('weaknesses')} value={character.weaknesses || t('common_na')} />
      <DetailField label={t('biography')} value={character.biography || t('common_na')} />
      <DetailField label={t('planned_timeline')} value={character.plannedTimeline || t('common_na')} />

      <CustomAttributeDetailFields storyId={character.storyId} entityType="Character" entityId={characterId} />

      <DetailField label={t('is_favorite')} value={character.isFavorite ? t('common_yes') : t('common_no')} />
      <DetailField label={t('extra_notes')} value={character.extraNotes || t('common_na')} />

      <Text style={styles.sectionTitle}>{t('media_section_title')}</Text>
      <EntityGalleryManager
        ownerId={characterId}
        ownerType="Character"
        onPressMedia={openGalleryMediaViewer}
        editable={canEdit}
      />

      <CharacterRelationManager
        characterRelations={characterRelations}
        characters={allCharacters}
        onSave={handleSaveRelation}
        onDelete={handleDeleteRelation}
        editable={false}
        currentStoryId={character.storyId}
        currentCharacterId={characterId}
      />

      <CharacterSceneManager
        characterSceneRelations={characterSceneRelations}
        availableScenes={allScenes}
        onSave={handleSaveCharacterScene}
        onDelete={handleDeleteCharacterScene}
        currentStoryId={character.storyId}
        currentCharacterId={characterId}
        editable={false}
      />

      <ItemCharacterManager
        allItems={allItems}
        allItemJourneys={allItemJourneys}
        allScenes={allScenes}
        currentCharacterId={characterId}
      />

      <CharacterLocationManager
        characterSceneRelations={characterSceneRelations}
        availableScenes={allScenes}
        availableLocations={allLocations}
        currentCharacterId={characterId}
      />

      <NoteManager
        noteRelations={characterNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
        editable={false}
        currentStoryId={character.storyId}
        currentEntityId={characterId}
        currentEntityType="Character"
      />

      <EntityMetadata version={character.version} createdAt={character.createdAt} updatedAt={character.updatedAt} />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default CharacterDetailScreen;