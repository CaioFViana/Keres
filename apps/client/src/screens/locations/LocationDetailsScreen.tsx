import NoteManager from '@/src/components/NoteManager';
import { Ionicons } from '@expo/vector-icons';
import { CharacterScene } from '@keres/shared/entities/CharacterScene'; // Import CharacterScene
import { Item, ItemJourney } from '@keres/shared/entities/Item'; // Import Item and ItemJourney entities
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import CustomAttributeDetailFields from '../../components/common/CustomAttributeFields/CustomAttributeDetailFields';
import DetailField from '../../components/common/DetailField/DetailField';
import EntityMetadata from '../../components/common/EntityMetadata/EntityMetadata';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import TagChipList from '../../components/common/TagChipList/TagChipList';
import EntityGalleryManager from '../../components/GalleryManager/EntityGalleryManager';
import LocationCharacterManager from '../../components/LocationManager/LocationCharacterManager'; // Import LocationCharacterManager
import LocationItemManager from '../../components/LocationManager/LocationItemManager'; // Import LocationItemManager
import LocationSceneManager from '../../components/LocationManager/LocationSceneManager'; // Import LocationSceneManager
import LocationRelationManager from '../../components/LocationRelationManager/LocationRelationManager';
import { useDrizzle } from '../../db';
import { LocationRelationSelect, LocationSelect, SceneSelect } from '../../db/schema'; // Explicitly import SceneSelect
import { CharacterSelect } from '../../db/schemas/characters'; // Import CharacterSelect
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useOpenGalleryMediaViewer } from '../../hooks/useOpenGalleryMediaViewer';
import { useStoryRole } from '../../hooks/useStoryRole';
import { LocationStackParamList } from '../../navigation/MainSystemStack';
import { CharacterSceneServiceInterface, createCharacterSceneService } from '../../services/storymanagement/CharacterSceneService'; // Import CharacterSceneService
import { CharacterService, createCharacterService } from '../../services/storymanagement/CharacterService'; // Import CharacterService
import { createItemJourneyService, ItemJourneyService } from '../../services/storymanagement/ItemJourneyService'; // Import ItemJourneyService
import { createItemService, ItemService } from '../../services/storymanagement/ItemService'; // Import ItemService
import { createLocationService } from '../../services/storymanagement/LocationService';
import { createLocationRelationService, LocationRelationService } from '../../services/storymanagement/LocationRelationService';
import { createSceneService } from '../../services/storymanagement/SceneService'; // Import createSceneService
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { setDocumentTitle } from '../../utils/documentTitle';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { LocationsScreenNavigationProp } from './LocationListScreen';
import { AppAlert } from '../../utils/AppAlert';

export type LocationDetailScreenParamList = {
  LocationDetail: { locationId: string };
};

type LocationDetailScreenRouteProp = RouteProp<LocationStackParamList, 'LocationDetail'>;

const LocationDetailsScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<LocationsScreenNavigationProp>(); // Use the imported navigation type
  const openGalleryMediaViewer = useOpenGalleryMediaViewer();
  const route = useRoute<LocationDetailScreenRouteProp>();
  const { locationId } = route.params;
  const { t } = useTranslation();
  const { selectedStory } = useStoryStore();
  const { userId } = useUserSettingsStore();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const drizzleDb = useDrizzle();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const locationServiceRef = useRef<ReturnType<typeof createLocationService> | null>(null);
  const locationRelationServiceRef = useRef<LocationRelationService | null>(null);
  const characterServiceRef = useRef<CharacterService | null>(null); // Ref for CharacterService
  const characterSceneServiceRef = useRef<CharacterSceneServiceInterface | null>(null); // Ref for CharacterSceneService
  const itemServiceRef = useRef<ItemService | null>(null); // Ref for ItemService
  const itemJourneyServiceRef = useRef<ItemJourneyService | null>(null); // Ref for ItemJourneyService

  const [location, setLocation] = useState<LocationSelect | null>(null);
  const { canEdit } = useStoryRole(location?.storyId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));
  const [allCharacters, setAllCharacters] = useState<CharacterSelect[]>([]); // State for all characters in story
  const [allScenes, setAllScenes] = useState<SceneSelect[]>([]); // State for all scenes in story
  const [characterSceneRelations, setCharacterSceneRelations] = useState<CharacterScene[]>([]); // State for character scene relations
  const [allItems, setAllItems] = useState<Item[]>([]); // State for all items in story
  const [allItemJourneys, setAllItemJourneys] = useState<ItemJourney[]>([]); // State for all item journeys in story
  const [allLocations, setAllLocations] = useState<LocationSelect[]>([]); // State for all locations in story
  const [allLocationRelations, setAllLocationRelations] = useState<LocationRelationSelect[]>([]); // State for all Location relations in story

  const {
    selectedTags: locationTags,
    allNotes,
    noteRelations: locationNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Location', entityId: locationId });


  useEffect(() => {
    if (drizzleDb) {
      if (!locationServiceRef.current) {
        locationServiceRef.current = createLocationService(drizzleDb);
      }
      if (!locationRelationServiceRef.current) {
        locationRelationServiceRef.current = createLocationRelationService(drizzleDb);
      }
      if (!characterServiceRef.current) {
        characterServiceRef.current = createCharacterService(drizzleDb);
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
    }
  }, [drizzleDb]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: headerTitle,
        headerRight: () => (
          location && canEdit ? (
            <TouchableOpacity onPress={() => navigation.navigate('LocationForm', { locationId: location.id })}>
              <Ionicons name="pencil-outline" size={24} color={colors.primary} style={{ marginRight: 15 }} />
            </TouchableOpacity>
          ) : null
        ),
      });
      setDocumentTitle(headerTitle);
    }, [navigation, location, headerTitle, colors, canEdit])
  );

  const fetchLocationDetails = useCallback(async () => {
    if (!locationServiceRef.current || !locationId) {
      setError(t('failed_to_load_location'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const fetchedLocation = await locationServiceRef.current.getById(locationId);
      if (fetchedLocation && !fetchedLocation.isDeleted) {
        setLocation(fetchedLocation);
        setHeaderTitle(fetchedLocation.name || t('location_details_title'));
      } else if (fetchedLocation && fetchedLocation.isDeleted) {
        navigation.goBack();
      }
      else {
        setError(t('location_not_found'));
        setHeaderTitle(t('location_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch location details:', err);
      setError(t('failed_to_load_location'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [locationId, navigation, setLocation, setLoading, setError, setHeaderTitle, t]);

  const fetchAllCharactersInStory = useCallback(async () => {
    if (!characterServiceRef.current || !selectedStory?.id) {
      setAllCharacters([]);
      return;
    }
    try {
      const fetchedCharacters = await characterServiceRef.current.getAllByStoryId(selectedStory.id);
      setAllCharacters(fetchedCharacters.filter(c => !c.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all characters:', err);
    }
  }, [selectedStory?.id]);

  const fetchAllScenesInStory = useCallback(async () => {
    if (!drizzleDb || !selectedStory?.id) {
      setAllScenes([]);
      return;
    }
    try {
      // Assuming createSceneService exists and is imported
      const sceneService = createSceneService(drizzleDb); // Need to import createSceneService
      const fetchedScenes = await sceneService.getScenesByStoryId(selectedStory.id);
      setAllScenes(fetchedScenes.filter(s => !s.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all scenes:', err);
    }
  }, [selectedStory?.id, drizzleDb]);

  const fetchAllCharacterSceneRelations = useCallback(async () => {
    if (!characterSceneServiceRef.current || !selectedStory?.id) {
      setCharacterSceneRelations([]);
      return;
    }
    try {
      const fetchedRelations = await characterSceneServiceRef.current.getRelationsByStoryId(selectedStory.id);
      setCharacterSceneRelations(fetchedRelations.filter((cs: CharacterScene) => !cs.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all character scene relations:', err);
    }
  }, [selectedStory?.id]);

  const fetchAllItemsInStory = useCallback(async () => {
    if (!itemServiceRef.current || !selectedStory?.id) {
      setAllItems([]);
      return;
    }
    try {
      const fetchedItems = await itemServiceRef.current.getAllByStoryId(selectedStory.id);
      setAllItems(fetchedItems.filter(i => !i.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all items:', err);
    }
  }, [selectedStory?.id]);

  const fetchAllItemJourneysInStory = useCallback(async () => {
    if (!itemJourneyServiceRef.current || !selectedStory?.id) {
      setAllItemJourneys([]);
      return;
    }
    try {
      const fetchedItemJourneys = await itemJourneyServiceRef.current.getAllByStoryId(selectedStory.id);
      setAllItemJourneys(fetchedItemJourneys.filter(ij => !ij.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all item journeys:', err);
    }
  }, [selectedStory?.id]);

  const fetchAllLocationsInStory = useCallback(async () => {
    if (!locationServiceRef.current || !selectedStory?.id) {
      setAllLocations([]);
      return;
    }
    try {
      const fetchedLocations = await locationServiceRef.current.getAllByStoryId(selectedStory.id);
      setAllLocations(fetchedLocations.filter(l => !l.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all locations:', err);
    }
  }, [selectedStory?.id]);

  const fetchAllLocationRelationsInStory = useCallback(async () => {
    if (!locationRelationServiceRef.current || !selectedStory?.id) {
      setAllLocationRelations([]);
      return;
    }
    try {
      const fetchedRelations = await locationRelationServiceRef.current.getAllRelationsForStory(selectedStory.id);
      setAllLocationRelations(fetchedRelations);
    } catch (err) {
      console.error('Failed to fetch all location relations:', err);
    }
  }, [selectedStory?.id]);

  const handleLocationChange = useCallback(async (changedStoryId: string, changedLocationId: string) => {
    if (changedLocationId === locationId) {
      if (locationServiceRef.current) {
        const updatedLocation = await locationServiceRef.current.getById(locationId);
        if (!updatedLocation || updatedLocation.isDeleted) {
          navigation.goBack();
        } else {
          setLocation(updatedLocation);
        }
      }
    }
    if (selectedStory?.id === changedStoryId) {
      fetchAllLocationsInStory();
    }
  }, [locationId, navigation, setLocation, selectedStory?.id, fetchAllLocationsInStory]);

  const handleLocationRelationChange = useCallback((changedStoryId: string) => {
    if (selectedStory?.id === changedStoryId) {
      fetchAllLocationRelationsInStory();
    }
  }, [selectedStory?.id, fetchAllLocationRelationsInStory]);

  const handleCharacterChange = useCallback((changedStoryId: string, changedCharacterId: string) => {
    if (selectedStory?.id === changedStoryId) {
      fetchAllCharactersInStory();
    }
  }, [selectedStory?.id, fetchAllCharactersInStory]);

  const handleCharacterSceneChange = useCallback((changedStoryId: string, changedCharacterSceneId: string) => {
    if (selectedStory?.id === changedStoryId) {
      fetchAllCharacterSceneRelations();
    }
  }, [selectedStory?.id, fetchAllCharacterSceneRelations]);

  const handleSceneChange = useCallback((changedStoryId: string, changedSceneId: string) => {
    if (selectedStory?.id === changedStoryId) {
      fetchAllScenesInStory();
    }
  }, [selectedStory?.id, fetchAllScenesInStory]);

  const handleItemChange = useCallback((changedStoryId: string, changedItemId: string) => {
    if (selectedStory?.id === changedStoryId) {
      fetchAllItemsInStory();
    }
  }, [selectedStory?.id, fetchAllItemsInStory]);

  const handleItemJourneyChange = useCallback((changedStoryId: string, changedItemJourneyId: string) => {
    if (selectedStory?.id === changedStoryId) {
      fetchAllItemJourneysInStory();
    }
  }, [selectedStory?.id, fetchAllItemJourneysInStory]);

  const handleSetParent = useCallback(async (newParentId: string | null) => {
    if (!locationRelationServiceRef.current || !selectedStory?.id || !userId) return;
    try {
      await locationRelationServiceRef.current.setParent(userId, selectedStory.id, locationId, newParentId);
    } catch (err) {
      AppAlert.alert(t('error'), err instanceof Error ? err.message : t('failed_to_save_relation'));
    }
  }, [selectedStory?.id, userId, locationId, t]);

  const handleAddChild = useCallback(async (childId: string) => {
    if (!locationRelationServiceRef.current || !selectedStory?.id || !userId) return;
    try {
      await locationRelationServiceRef.current.setParent(userId, selectedStory.id, childId, locationId);
    } catch (err) {
      AppAlert.alert(t('error'), err instanceof Error ? err.message : t('failed_to_save_relation'));
    }
  }, [selectedStory?.id, userId, locationId, t]);

  const handleAddConnection = useCallback(async (otherLocationId: string) => {
    if (!locationRelationServiceRef.current || !selectedStory?.id || !userId) return;
    try {
      await locationRelationServiceRef.current.addConnection(userId, selectedStory.id, locationId, otherLocationId);
    } catch (err) {
      AppAlert.alert(t('error'), err instanceof Error ? err.message : t('failed_to_save_relation'));
    }
  }, [selectedStory?.id, userId, locationId, t]);

  const handleRemoveLocationRelation = useCallback(async (relationId: string) => {
    if (!locationRelationServiceRef.current || !userId) return;
    try {
      await locationRelationServiceRef.current.removeRelation(userId, relationId);
    } catch (err) {
      AppAlert.alert(t('error'), err instanceof Error ? err.message : t('failed_to_remove_relation'));
    }
  }, [userId, t]);

  // Notes, note relations and tags are kept fresh by useEntityRelations.
  useEffect(() => {
    if (locationServiceRef.current) {
      fetchLocationDetails();
      entityEventEmitter.on('location_changed', handleLocationChange);
      entityEventEmitter.on('character_changed', handleCharacterChange);
      entityEventEmitter.on('character_scene_changed', handleCharacterSceneChange);
      entityEventEmitter.on('scene_changed', handleSceneChange);
      entityEventEmitter.on('item_changed', handleItemChange);
      entityEventEmitter.on('item_journey_changed', handleItemJourneyChange);
      entityEventEmitter.on('location_relation_changed', handleLocationRelationChange);

      return () => {
        entityEventEmitter.off('location_changed', handleLocationChange);
        entityEventEmitter.off('character_changed', handleCharacterChange);
        entityEventEmitter.off('character_scene_changed', handleCharacterSceneChange);
        entityEventEmitter.off('scene_changed', handleSceneChange);
        entityEventEmitter.off('item_changed', handleItemChange);
        entityEventEmitter.off('item_journey_changed', handleItemJourneyChange);
        entityEventEmitter.off('location_relation_changed', handleLocationRelationChange);
      };
    }
  }, [locationId, fetchLocationDetails, handleLocationChange, handleCharacterChange,
    handleCharacterSceneChange, handleSceneChange, handleItemChange, handleItemJourneyChange, handleLocationRelationChange]);

  useEffect(() => {
    if (location) {
      fetchAllCharactersInStory(); // Fetch all characters
      fetchAllScenesInStory(); // Fetch all scenes
      fetchAllCharacterSceneRelations(); // Fetch all character scene relations
      fetchAllItemsInStory(); // Fetch all items
      fetchAllItemJourneysInStory(); // Fetch all item journeys
      fetchAllLocationsInStory(); // Fetch all locations
      fetchAllLocationRelationsInStory(); // Fetch all Location relations
    }
  }, [location, fetchAllCharactersInStory, fetchAllScenesInStory, fetchAllCharacterSceneRelations, fetchAllItemsInStory, fetchAllItemJourneysInStory, fetchAllLocationsInStory, fetchAllLocationRelationsInStory]);

  const styles = StyleSheet.create({
    scrollViewContent: {
      padding: 20,
      paddingBottom: scrollBottomPadding,
      flexGrow: 1,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 10,
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

  if (loading) {
    return <ScreenLoading padded message={t('loading_location_details')} />;
  }

  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }

  if (!location) {
    return <ScreenError padded message={t('location_not_found')} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
      <TagChipList tags={locationTags} />

      <DetailField label={t('description')} value={location.description || t('common_na')} />
      <DetailField label={t('field_climate')} value={location.climate || t('common_na')} />
      <DetailField label={t('field_culture')} value={location.culture || t('common_na')} />
      <DetailField label={t('field_politics')} value={location.politics || t('common_na')} />

      <CustomAttributeDetailFields storyId={location.storyId} entityType="Location" entityId={locationId} />

      <DetailField label={t('extra_notes')} value={location.extraNotes || t('common_na')} />

      <LocationRelationManager
        currentLocationId={locationId}
        allLocations={allLocations}
        allLocationRelations={allLocationRelations}
        onSetParent={handleSetParent}
        onAddChild={handleAddChild}
        onAddConnection={handleAddConnection}
        onRemoveRelation={handleRemoveLocationRelation}
        editable={canEdit}
      />

      <Text style={styles.sectionTitle}>{t('media_section_title')}</Text>
      <EntityGalleryManager
        ownerId={locationId}
        ownerType="Location"
        onPressMedia={openGalleryMediaViewer}
        editable={canEdit}
      />

      <LocationCharacterManager
        currentLocationId={locationId}
        availableScenes={allScenes}
        characterSceneRelations={characterSceneRelations}
        availableCharacters={allCharacters}
      />

      <LocationSceneManager
        currentLocationId={locationId}
        availableScenes={allScenes}
      />

      <LocationItemManager
        currentLocationId={locationId}
        availableItemJourneys={allItemJourneys}
        availableItems={allItems}
        availableScenes={allScenes}
        availableCharacters={allCharacters}
      />

      <NoteManager
        noteRelations={locationNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={locationId}
        currentEntityType="Location"
      />

      <EntityMetadata version={location.version} createdAt={location.createdAt} updatedAt={location.updatedAt} />
    </ScrollView>
  );
};

export default LocationDetailsScreen;
