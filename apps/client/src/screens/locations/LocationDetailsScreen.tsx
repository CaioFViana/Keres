import NoteManager from '@/src/components/NoteManager';
import { Ionicons } from '@expo/vector-icons';
import { CharacterScene } from '@keres/shared/entities/CharacterScene'; // Import CharacterScene
import { Item, ItemJourney } from '@keres/shared/entities/Item'; // Import Item and ItemJourney entities
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LocationCharacterManager from '../../components/LocationManager/LocationCharacterManager'; // Import LocationCharacterManager
import LocationItemManager from '../../components/LocationManager/LocationItemManager'; // Import LocationItemManager
import LocationSceneManager from '../../components/LocationManager/LocationSceneManager'; // Import LocationSceneManager
import TagChipList from '../../components/common/TagChipList/TagChipList';
import { useDrizzle } from '../../db';
import { LocationSelect, SceneSelect } from '../../db/schema'; // Explicitly import SceneSelect
import { CharacterSelect } from '../../db/schemas/characters'; // Import CharacterSelect
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { LocationStackParamList } from '../../navigation/MainSystemStack';
import { CharacterSceneServiceInterface, createCharacterSceneService } from '../../services/storymanagement/CharacterSceneService'; // Import CharacterSceneService
import { CharacterService, createCharacterService } from '../../services/storymanagement/CharacterService'; // Import CharacterService
import { createItemJourneyService, ItemJourneyService } from '../../services/storymanagement/ItemJourneyService'; // Import ItemJourneyService
import { createItemService, ItemService } from '../../services/storymanagement/ItemService'; // Import ItemService
import { createLocationService } from '../../services/storymanagement/LocationService';
import { createSceneService } from '../../services/storymanagement/SceneService'; // Import createSceneService
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { LocationsScreenNavigationProp } from './LocationListScreen';

export type LocationDetailScreenParamList = {
  LocationDetail: { locationId: string };
};

type LocationDetailScreenRouteProp = RouteProp<LocationStackParamList, 'LocationDetail'>;

const LocationDetailsScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<LocationsScreenNavigationProp>(); // Use the imported navigation type
  const route = useRoute<LocationDetailScreenRouteProp>();
  const { locationId } = route.params;
  const { t } = useTranslation();
  const { selectedStory } = useStoryStore();
  const drizzleDb = useDrizzle();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const locationServiceRef = useRef<ReturnType<typeof createLocationService> | null>(null);
  const characterServiceRef = useRef<CharacterService | null>(null); // Ref for CharacterService
  const characterSceneServiceRef = useRef<CharacterSceneServiceInterface | null>(null); // Ref for CharacterSceneService
  const itemServiceRef = useRef<ItemService | null>(null); // Ref for ItemService
  const itemJourneyServiceRef = useRef<ItemJourneyService | null>(null); // Ref for ItemJourneyService

  const [location, setLocation] = useState<LocationSelect | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));
  const [allCharacters, setAllCharacters] = useState<CharacterSelect[]>([]); // State for all characters in story
  const [allScenes, setAllScenes] = useState<SceneSelect[]>([]); // State for all scenes in story
  const [characterSceneRelations, setCharacterSceneRelations] = useState<CharacterScene[]>([]); // State for character scene relations
  const [allItems, setAllItems] = useState<Item[]>([]); // State for all items in story
  const [allItemJourneys, setAllItemJourneys] = useState<ItemJourney[]>([]); // State for all item journeys in story

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
          location ? (
            <TouchableOpacity onPress={() => navigation.navigate('LocationForm', { locationId: location.id })}>
              <Ionicons name="pencil-outline" size={24} color={colors.primary} style={{ marginRight: 15 }} />
            </TouchableOpacity>
          ) : null
        ),
      });
    }, [navigation, location, headerTitle, colors])
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
  }, [locationId, navigation, setLocation]);

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

      return () => {
        entityEventEmitter.off('location_changed', handleLocationChange);
        entityEventEmitter.off('character_changed', handleCharacterChange);
        entityEventEmitter.off('character_scene_changed', handleCharacterSceneChange);
        entityEventEmitter.off('scene_changed', handleSceneChange);
        entityEventEmitter.off('item_changed', handleItemChange);
        entityEventEmitter.off('item_journey_changed', handleItemJourneyChange);
      };
    }
  }, [locationId, fetchLocationDetails, handleLocationChange, handleCharacterChange,
    handleCharacterSceneChange, handleSceneChange, handleItemChange, handleItemJourneyChange]);

  useEffect(() => {
    if (location) {
      fetchAllCharactersInStory(); // Fetch all characters
      fetchAllScenesInStory(); // Fetch all scenes
      fetchAllCharacterSceneRelations(); // Fetch all character scene relations
      fetchAllItemsInStory(); // Fetch all items
      fetchAllItemJourneysInStory(); // Fetch all item journeys
    }
  }, [location, fetchAllCharactersInStory, fetchAllScenesInStory, fetchAllCharacterSceneRelations, fetchAllItemsInStory, fetchAllItemJourneysInStory]);

  const styles = StyleSheet.create({
    scrollViewContent: {
      padding: 20,
      flexGrow: 1,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 10,
    },
    detailItem: {
      marginBottom: 10,
    },
    detailLabel: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.textSecondary,
      marginBottom: 2,
    },
    detailText: {
      fontSize: 16,
      color: colors.text,
    },
    errorText: {
      color: colors.error,
      textAlign: 'center',
      marginTop: 20,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
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
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.detailText}>{t('loading_location_details')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
        <View style={styles.buttonContainer}>
          <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={styles.errorText}>{t('location_not_found')}</Text>
        <View style={styles.buttonContainer}>
          <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
      <Text style={styles.title}>{location.name}</Text>

      {location.description && (
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('description')}</Text>
          <Text style={styles.detailText}>{location.description}</Text>
        </View>
      )}

      {location.climate && (
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('field_climate')}</Text>
          <Text style={styles.detailText}>{location.climate}</Text>
        </View>
      )}

      {location.culture && (
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('field_culture')}</Text>
          <Text style={styles.detailText}>{location.culture}</Text>
        </View>
      )}

      {location.politics && (
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('field_politics')}</Text>
          <Text style={styles.detailText}>{location.politics}</Text>
        </View>
      )}

      {location.extraNotes && (
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('extra_notes')}</Text>
          <Text style={styles.detailText}>{location.extraNotes}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>{t('characters_in_location_title')}</Text>
      <LocationCharacterManager
        currentLocationId={locationId}
        availableScenes={allScenes}
        characterSceneRelations={characterSceneRelations}
        availableCharacters={allCharacters}
      />

      <Text style={styles.sectionTitle}>{t('scenes_in_location_title')}</Text>
      <LocationSceneManager
        currentLocationId={locationId}
        availableScenes={allScenes}
      />

      <Text style={styles.sectionTitle}>{t('items_in_location_title')}</Text>
      <LocationItemManager
        currentLocationId={locationId}
        availableItemJourneys={allItemJourneys}
        availableItems={allItems}
        availableScenes={allScenes}
        availableCharacters={allCharacters}
      />

      <Text style={styles.sectionTitle}>{t('notes_title')}</Text>
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
      
      <View style={{ marginTop: 20 }}>
        <Text style={[styles.detailLabel, { marginBottom: 5 }]}>{t('tags_title')}</Text>
        <TagChipList tags={locationTags} />
      </View>
    </ScrollView>
  );
};

export default LocationDetailsScreen;