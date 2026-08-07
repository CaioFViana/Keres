import { Ionicons } from '@expo/vector-icons';
import { Chapter } from '@keres/shared/entities/Chapter';
import { CharacterScene } from '@keres/shared/entities/CharacterScene'; // Import CharacterScene entity
import { Choice } from '@keres/shared/entities/Choice'; // Import Choice
import { Item, ItemJourney } from '@keres/shared/entities/Item'; // Import Item and ItemJourney
import { Location } from '@keres/shared/entities/Location'; // Import Location
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CharacterRelationManager from '../../components/CharacterManager/CharacterRelationManager'; // Import CharacterRelationManager
import CustomAttributeDetailFields from '../../components/common/CustomAttributeFields/CustomAttributeDetailFields';
import DetailField from '../../components/common/DetailField/DetailField';
import EntityMetadata from '../../components/common/EntityMetadata/EntityMetadata';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import TagChipList from '../../components/common/TagChipList/TagChipList'; // Import TagChipList
import EntityGalleryManager from '../../components/GalleryManager/EntityGalleryManager';
import ItemSceneManager from '../../components/ItemManager/ItemSceneManager'; // Import ItemSceneManager
import NoteRelationManager from '../../components/NoteManager/NoteRelationManager'; // Import NoteRelationManager
import SceneNavigationControls from '../../components/SceneNavigationControls/SceneNavigationControls'; // Import SceneNavigationControls
import { useDrizzle } from '../../db';
import { SceneSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useOpenGalleryMediaViewer } from '../../hooks/useOpenGalleryMediaViewer';
import { useStoryRole } from '../../hooks/useStoryRole';
import type { MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { ChapterService, createChapterService } from '../../services/storymanagement/ChapterService'; // Import ChapterService
import { CharacterSceneServiceInterface, createCharacterSceneService } from '../../services/storymanagement/CharacterSceneService'; // Import CharacterSceneService
import { ChoiceService, createChoiceService } from '../../services/storymanagement/ChoiceService'; // Import ChoiceService
import { createItemJourneyService, ItemJourneyService } from '../../services/storymanagement/ItemJourneyService'; // Import ItemJourneyService
import { createItemService, ItemService } from '../../services/storymanagement/ItemService'; // Import ItemService
import { createLocationService, LocationService } from '../../services/storymanagement/LocationService';
import { createSceneService } from '../../services/storymanagement/SceneService';
import { useCharacterStore } from '../../state/characterStore'; // Import useCharacterStore
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { navigateToEntityDetail } from '../../utils/entityNavigation';
import { setDocumentTitle } from '../../utils/documentTitle';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { ScenesScreenNavigationProp } from './SceneListScreen';

// Define the parameter list for this screen
export type SceneDetailScreenParamList = {
  SceneDetail: { sceneId: string };
};

type SceneDetailScreenRouteProp = RouteProp<SceneDetailScreenParamList, 'SceneDetail'>;

const SceneDetailScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<ScenesScreenNavigationProp>();
  const openGalleryMediaViewer = useOpenGalleryMediaViewer();
  const route = useRoute<SceneDetailScreenRouteProp>();
  const { sceneId } = route.params;
  const { t } = useTranslation();
  const { selectedStory } = useStoryStore();
  const scrollBottomPadding = useFormScrollBottomPadding();

  const drizzleDb = useDrizzle();
  const sceneServiceRef = useRef<ReturnType<typeof createSceneService> | null>(null);
  const chapterServiceRef = useRef<ChapterService | null>(null); // Ref for ChapterService
  const choiceServiceRef = useRef<ChoiceService | null>(null); // Ref for ChoiceService
  const characterSceneServiceRef = useRef<CharacterSceneServiceInterface | null>(null); // Ref for CharacterSceneService
  const locationServiceRef = useRef<LocationService | null>(null); // Ref for LocationService
  const itemServiceRef = useRef<ItemService | null>(null); // Ref for ItemService
  const itemJourneyServiceRef = useRef<ItemJourneyService | null>(null); // Ref for ItemJourneyService

  const { characters, fetchCharacters, setDbAndStoryId: setCharacterDbAndStoryId, initializeService: initializeCharacterService } = useCharacterStore(); // For character data

  // Initialize services once when drizzleDb is available
  useEffect(() => {
    if (drizzleDb) {
      if (!sceneServiceRef.current) {
        sceneServiceRef.current = createSceneService(drizzleDb);
      }
      if (!chapterServiceRef.current) {
        chapterServiceRef.current = createChapterService(drizzleDb);
      }
      if (!choiceServiceRef.current) {
        choiceServiceRef.current = createChoiceService(drizzleDb);
      }
      if (!characterSceneServiceRef.current) {
        characterSceneServiceRef.current = createCharacterSceneService(drizzleDb);
      }
      if (!locationServiceRef.current) {
        locationServiceRef.current = createLocationService(drizzleDb);
      }
      if (!itemServiceRef.current) {
        itemServiceRef.current = createItemService(drizzleDb);
      }
      if (!itemJourneyServiceRef.current) {
        itemJourneyServiceRef.current = createItemJourneyService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  // Initialize Character Service and fetch characters
  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setCharacterDbAndStoryId(drizzleDb, selectedStory.id);
      initializeCharacterService();
      fetchCharacters();
    }
  }, [drizzleDb, selectedStory?.id, setCharacterDbAndStoryId, initializeCharacterService, fetchCharacters]);

  const [scene, setScene] = useState<SceneSelect | null>(null);
  const { canEdit } = useStoryRole(scene?.storyId);
  const [chapter, setChapter] = useState<Chapter | null>(null); // State for chapter details
  const [location, setLocation] = useState<Location | null>(null); // State for location details
  const [previousScene, setPreviousScene] = useState<SceneSelect | undefined>(undefined); // State for previous scene
  const [nextScene, setNextScene] = useState<SceneSelect | undefined>(undefined); // State for next scene
  const [choicesForScene, setChoicesForScene] = useState<Choice[]>([]); // State for choices
  const {
    selectedTags: sceneTags,
    allNotes,
    noteRelations: sceneNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Scene', entityId: sceneId });
  const [characterSceneRelations, setCharacterSceneRelations] = useState<CharacterScene[]>([]); // State for character-scene relations
  const [allItems, setAllItems] = useState<Item[]>([]); // State for all items in the story
  const [itemJourneys, setItemJourneys] = useState<ItemJourney[]>([]); // State for item journeys related to the scene
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

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
    locationLink: {
      flexDirection: 'row',
      alignItems: 'center',
    },
  });

  const fetchScene = useCallback(async () => {
    if (!sceneServiceRef.current) {
      console.warn('Scene service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedScene = await sceneServiceRef.current.getById(sceneId);
      if (fetchedScene && !fetchedScene.isDeleted) {
        setScene(fetchedScene);
        setHeaderTitle(fetchedScene.name || t('scene_details_title'));
      } else if (fetchedScene && fetchedScene.isDeleted) {
        navigation.goBack();
      } else {
        setError(t('scene_not_found'));
        setHeaderTitle(t('scene_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch scene details:', err);
      setError(t('failed_to_load_scene'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [sceneId, setScene, setLoading, setError, setHeaderTitle, navigation, t]);

  const fetchChapter = useCallback(async () => {
    if (!chapterServiceRef.current || !scene?.chapterId) {
      setChapter(null);
      return;
    }
    try {
      const fetchedChapter = await chapterServiceRef.current.getById(scene.chapterId);
      setChapter(fetchedChapter || null);
    } catch (err) {
      console.error('Failed to fetch chapter details:', err);
      setChapter(null);
    }
  }, [scene?.chapterId]);

  const fetchLocation = useCallback(async () => {
    if (!locationServiceRef.current || !scene?.locationId) {
      setLocation(null);
      return;
    }
    try {
      const fetchedLocation = await locationServiceRef.current.getById(scene.locationId);
      setLocation(fetchedLocation || null);
    } catch (err) {
      console.error('Failed to fetch location details:', err);
      setLocation(null);
    }
  }, [scene?.locationId]);

  const fetchPreviousNextScenes = useCallback(async () => {
    if (!sceneServiceRef.current || !selectedStory?.id || !sceneId || !chapter?.id || selectedStory.type !== 'linear') {
      setPreviousScene(undefined);
      setNextScene(undefined);
      return;
    }
    try {
      const { previousScene, nextScene } = await sceneServiceRef.current.getPreviousNextScenes(selectedStory.id, sceneId, chapter.id);
      setPreviousScene(previousScene);
      setNextScene(nextScene);
    } catch (err) {
      console.error('Failed to fetch previous/next scenes:', err);
      setPreviousScene(undefined);
      setNextScene(undefined);
    }
  }, [selectedStory?.id, sceneId, chapter?.id, selectedStory?.type]);

  const fetchChoicesForScene = useCallback(async () => {
    if (!choiceServiceRef.current || !selectedStory?.id || !sceneId || selectedStory.type !== 'branching') {
      setChoicesForScene([]);
      return;
    }
    try {
      // `sceneId` é o critério que o serviço entende e filtra pelas escolhas que *saem* desta
      // cena, que é o que os botões de navegação abaixo oferecem. `fromSceneId` não existia:
      // caía na varredura de critérios genéricos e derrubava a consulta.
      const choices = await choiceServiceRef.current.getChoicesByStoryId(selectedStory.id, undefined, undefined, undefined, undefined, { sceneId });
      setChoicesForScene(choices);
    } catch (err) {
      console.error('Failed to fetch choices for scene:', err);
      setChoicesForScene([]);
    }
  }, [selectedStory?.id, sceneId, selectedStory?.type]);

  const fetchCharacterSceneRelations = useCallback(async () => {
    if (!characterSceneServiceRef.current || !selectedStory?.id || !sceneId) {
      setCharacterSceneRelations([]);
      return;
    }
    try {
      const fetchedRelations = await characterSceneServiceRef.current.getRelationsForScene(selectedStory.id, sceneId);
      setCharacterSceneRelations(fetchedRelations);
    } catch (err) {
      console.error('Failed to fetch character-scene relations:', err);
    }
  }, [selectedStory?.id, sceneId]);

  const fetchAllItems = useCallback(async () => {
    if (!itemServiceRef.current || !selectedStory?.id) {
      setAllItems([]);
      return;
    }
    try {
      const fetchedItems = await itemServiceRef.current.getItemsByStoryId(selectedStory.id);
      setAllItems(fetchedItems);
    } catch (err) {
      console.error('Failed to fetch all items:', err);
    }
  }, [selectedStory?.id]);

  const fetchItemJourneysForScene = useCallback(async () => {
    if (!itemJourneyServiceRef.current || !selectedStory?.id || !sceneId) {
      setItemJourneys([]);
      return;
    }
    try {
      const fetchedJourneys = await itemJourneyServiceRef.current.getItemJourneysBySceneId(selectedStory.id, sceneId);
      setItemJourneys(fetchedJourneys);
    } catch (err) {
      console.error('Failed to fetch item journeys for scene:', err);
    }
  }, [selectedStory?.id, sceneId]);

  const handleItemChange = useCallback((changedStoryId: string, changedItemId: string) => {
    if (selectedStory?.id === changedStoryId) {
      fetchAllItems();
    }
  }, [selectedStory?.id, fetchAllItems]);

  const handleItemJourneyChange = useCallback((changedStoryId: string, changedItemJourneyId: string) => {
    if (selectedStory?.id === changedStoryId) {
      fetchItemJourneysForScene();
    }
  }, [selectedStory?.id, fetchItemJourneysForScene]);

  const handleSceneChange = useCallback(async (changedStoryId: string, changedSceneId: string) => {
    if (changedSceneId === sceneId) {
      if (sceneServiceRef.current) {
        const updatedScene = await sceneServiceRef.current.getById(sceneId);
        if (!updatedScene || updatedScene.isDeleted) {
          navigation.goBack();
        } else {
          setScene(updatedScene);
          setHeaderTitle(updatedScene.name || t('scene_details_title'));
        }
      }
      fetchChapter();
      if (selectedStory?.type === 'linear') {
        fetchPreviousNextScenes();
      } else if (selectedStory?.type === 'branching') {
        fetchChoicesForScene();
      }
    }
  }, [sceneId, navigation, setScene, setHeaderTitle, t, fetchChapter, selectedStory?.type, fetchPreviousNextScenes, fetchChoicesForScene]);

  const handleCharacterSceneChange = useCallback((changedStoryId: string, changedSceneId: string) => {
    if (changedSceneId === sceneId) {
      fetchCharacterSceneRelations();
    }
  }, [sceneId, fetchCharacterSceneRelations]);

  // Notes, note relations and tags are kept fresh by useEntityRelations.
  useEffect(() => {
    if (sceneServiceRef.current) {
      fetchScene();
      entityEventEmitter.on('scene_changed', handleSceneChange);
      entityEventEmitter.on('character_scene_changed', handleCharacterSceneChange); // Listen for character scene changes
      entityEventEmitter.on('item_changed', handleItemChange); // Listen for item changes
      entityEventEmitter.on('item_journey_changed', handleItemJourneyChange); // Listen for item journey changes

      return () => {
        entityEventEmitter.off('scene_changed', handleSceneChange);
        entityEventEmitter.off('character_scene_changed', handleCharacterSceneChange); // Cleanup listener
        entityEventEmitter.off('item_changed', handleItemChange); // Cleanup listener
        entityEventEmitter.off('item_journey_changed', handleItemJourneyChange); // Cleanup listener
      };
    }
  }, [sceneId, fetchScene, handleSceneChange, handleCharacterSceneChange, handleItemChange, handleItemJourneyChange]);

  useEffect(() => {
    if (scene) {
      fetchChapter();
      fetchLocation();
      fetchCharacterSceneRelations();
      fetchAllItems(); // Fetch all items when scene changes
      fetchItemJourneysForScene(); // Fetch item journeys for scene when scene changes
    }
  }, [scene, fetchChapter, fetchLocation, fetchCharacterSceneRelations, fetchAllItems, fetchItemJourneysForScene]);

  useEffect(() => {
    if (selectedStory?.type === 'linear' && scene && chapter) {
      fetchPreviousNextScenes();
    } else if (selectedStory?.type === 'branching' && scene) {
      fetchChoicesForScene();
    }
  }, [selectedStory, selectedStory?.type, scene, chapter, fetchPreviousNextScenes, fetchChoicesForScene]);

  const handleLocationPress = useCallback(() => {
    if (!location) return;
    const drawerNavigation = navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>();
    if (drawerNavigation) {
      navigateToEntityDetail(drawerNavigation, 'Location', location.id);
    }
  }, [navigation, location]);

  const renderHeaderRight = useCallback(() => (
    canEdit ? (
      <TouchableOpacity
        onPress={() => navigation.navigate('SceneForm', { sceneId: sceneId })}
        style={{ marginRight: 15 }}
      >
        <Ionicons name="pencil-outline" size={24} color={colors.text} />
      </TouchableOpacity>
    ) : null
  ), [navigation, sceneId, colors.text, canEdit]);

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
    return <ScreenLoading padded message={t('loading_scene_details')} />;
  }

  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }

  if (!scene) {
    return <ScreenError padded message={t('scene_data_missing')} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <ScrollView style={commonContainerStyles.container} contentContainerStyle={{ paddingBottom: scrollBottomPadding }}>
      {chapter && (
        <Text style={styles.subTitle}>
          {selectedStory?.type === 'linear' ? `${chapter.index}. ` : ''}
          {chapter.name}
        </Text>
      )}
      <TagChipList tags={sceneTags} />
      <DetailField label={t('summary')} value={scene.summary || t('common_na')} />

      <CustomAttributeDetailFields storyId={scene.storyId} entityType="Scene" entityId={sceneId} />

      <DetailField label={t('is_favorite')} value={scene.isFavorite ? t('common_yes') : t('common_no')} />
      <DetailField label={t('extra_notes')} value={scene.extraNotes || t('common_na')} />

      {location && (
        <>
          <Text style={styles.sectionTitle}>{t('location')}</Text>
          <TouchableOpacity onPress={handleLocationPress} style={styles.locationLink} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <DetailField label={t('name')} value={location.name} />
              <DetailField label={t('description')} value={location.description || t('common_na')} />
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.sectionTitle}>{t('media_section_title')}</Text>
      <EntityGalleryManager
        ownerId={sceneId}
        ownerType="Scene"
        onPressMedia={openGalleryMediaViewer}
        editable={canEdit}
      />

      <CharacterRelationManager
        characterRelations={characterSceneRelations}
        availableCharacters={characters.filter(char => !char.isDeleted)}
        onSave={() => Promise.resolve()}
        onDelete={() => Promise.resolve()}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentSceneId={sceneId}
      />

      <ItemSceneManager
        itemJourneys={itemJourneys}
        allItems={allItems.filter(item => !item.isDeleted)}
        allCharacters={characters.filter(char => !char.isDeleted)}
        currentSceneId={sceneId}
      />

      <NoteRelationManager
        noteRelations={sceneNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={sceneId}
        currentEntityType="Scene"
      />

      <SceneNavigationControls
        storyType={selectedStory?.type}
        previousScene={previousScene}
        nextScene={nextScene}
        choicesForScene={choicesForScene}
      />

      <EntityMetadata version={scene.version} createdAt={scene.createdAt} updatedAt={scene.updatedAt} />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};


export default SceneDetailScreen;