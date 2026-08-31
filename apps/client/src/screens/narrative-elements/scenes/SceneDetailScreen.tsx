import DetailField from '@/src/components/common/display/DetailField/DetailField';
import EntityMetadata from '@/src/components/features/mentions/EntityMetadataWithBacklinks';
import TagList from '@/src/components/common/display/TagList/TagList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import CustomAttributeDetailFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields';
import SceneCharacterManager from '@/src/components/features/characters/CharacterManager/SceneCharacterManager';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import FavoritedByList from '@/src/components/features/favorites/FavoritedByList/FavoritedByList';
import EntityGalleryManager from '@/src/components/features/gallery/GalleryManager/EntityGalleryManager';
import ItemSceneManager from '@/src/components/features/items/ItemManager/ItemSceneManager'; // Import ItemSceneManager
import NoteRelationManager from '@/src/components/features/notes/NoteManager/NoteRelationManager'; // Import NoteRelationManager
import SceneNavigationControls from '@/src/components/features/scenes/SceneNavigationControls/SceneNavigationControls'; // Import SceneNavigationControls
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { Ionicons } from '@expo/vector-icons';
import type { Chapter } from '@keres/shared/entities/Chapter';
import type { CharacterScene } from '@keres/shared/entities/CharacterScene'; // Import CharacterScene entity
import type { Choice } from '@keres/shared/entities/Choice'; // Import Choice
import type { Effect } from '@keres/shared/entities/Effect';
import type { Item, ItemJourney } from '@keres/shared/entities/Item'; // Import Item and ItemJourney
import type { Location } from '@keres/shared/entities/Location'; // Import Location
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../../db';
import type { SceneSelect } from '../../../db/schema';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useEntityComments } from '../../../hooks/useEntityComments';
import { useEntityRelations } from '../../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../../hooks/useFormScrollBottomPadding';
import { useNavigateToEntityDetail } from '../../../hooks/useNavigateToEntityDetail';
import { useOpenGalleryMediaViewer } from '../../../hooks/useOpenGalleryMediaViewer';
import { useStoryRole } from '../../../hooks/useStoryRole';
import type { ChapterService } from '../../../services/storymanagement/ChapterService';
import { createChapterService } from '../../../services/storymanagement/ChapterService'; // Import ChapterService
import type { CharacterSceneServiceInterface } from '../../../services/storymanagement/CharacterSceneService';
import { createCharacterSceneService } from '../../../services/storymanagement/CharacterSceneService'; // Import CharacterSceneService
import type { ChoiceService } from '../../../services/storymanagement/ChoiceService';
import { createChoiceService } from '../../../services/storymanagement/ChoiceService'; // Import ChoiceService
import type { EffectService } from '../../../services/storymanagement/EffectService';
import { createEffectService } from '../../../services/storymanagement/EffectService';
import type { ItemJourneyService } from '../../../services/storymanagement/ItemJourneyService';
import { createItemJourneyService } from '../../../services/storymanagement/ItemJourneyService'; // Import ItemJourneyService
import type { ItemService } from '../../../services/storymanagement/ItemService';
import { createItemService } from '../../../services/storymanagement/ItemService'; // Import ItemService
import type { LocationService } from '../../../services/storymanagement/LocationService';
import { createLocationService } from '../../../services/storymanagement/LocationService';
import { createSceneService } from '../../../services/storymanagement/SceneService';
import { useCharacterStore } from '../../../state/characterStore'; // Import useCharacterStore
import { useStoryStore } from '../../../state/storyStore';
import { useVocabularyEntityCopy } from '../../../vocabulary/useVocabularyEntityCopy';
import { useStoryCalendar } from '../../../hooks/useStoryCalendar';
import { useSceneCalendarDates } from '../../../hooks/useSceneCalendarDates';
import { useEntityInitialLoad } from '../../../hooks/useEntityRefreshLifecycle';
import { useTheme } from '../../../theme';
import { commonDetailStyleDefs, getCommonContainerStyles } from '../../../theme/commonStyles';
import { setDocumentTitle } from '../../../utils/documentTitle';
import { entityEventEmitter } from '../../../utils/EventEmitter';
import { formatSceneGap, formatSceneUniverseDuration } from '../../../utils/sceneTiming';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import type { NarrativeElementsScreenNavigationProp } from '../chapters/NarrativeElementsListScreen';

// Define the parameter list for this screen
type SceneDetailScreenRouteProp = RouteProp<NarrativeElementsStackParamList, 'SceneDetail'>;

const SceneDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const { definition: calendar } = useStoryCalendar();
  const navigation = useNavigation<NarrativeElementsScreenNavigationProp>();
  const openGalleryMediaViewer = useOpenGalleryMediaViewer();
  const route = useRoute<SceneDetailScreenRouteProp>();
  const { sceneId } = route.params;
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Scene');
  const locationCopy = useVocabularyEntityCopy('Location');
  const { selectedStory } = useStoryStore();
  const { dateForScene } = useSceneCalendarDates(selectedStory?.id);
  const scrollBottomPadding = useFormScrollBottomPadding();

  const drizzleDb = useDrizzle();
  const sceneServiceRef = useRef<ReturnType<typeof createSceneService> | null>(null);
  const chapterServiceRef = useRef<ChapterService | null>(null); // Ref for ChapterService
  const choiceServiceRef = useRef<ChoiceService | null>(null); // Ref for ChoiceService
  const characterSceneServiceRef = useRef<CharacterSceneServiceInterface | null>(null); // Ref for CharacterSceneService
  const locationServiceRef = useRef<LocationService | null>(null); // Ref for LocationService
  const itemServiceRef = useRef<ItemService | null>(null); // Ref for ItemService
  const itemJourneyServiceRef = useRef<ItemJourneyService | null>(null); // Ref for ItemJourneyService
  const effectServiceRef = useRef<EffectService | null>(null); // Ref for EffectService

  const {
    characters,
    fetchCharacters,
    setDbAndStoryId: setCharacterDbAndStoryId,
    initializeService: initializeCharacterService,
  } = useCharacterStore(); // For character data

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
      if (!effectServiceRef.current) {
        effectServiceRef.current = createEffectService(drizzleDb);
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
  }, [
    drizzleDb,
    selectedStory?.id,
    setCharacterDbAndStoryId,
    initializeCharacterService,
    fetchCharacters,
  ]);

  const [scene, setScene] = useState<SceneSelect | null>(null);
  const { canEdit } = useStoryRole(scene?.storyId);
  const {
    commentsByField,
    canComment,
    isStoryOwner,
    currentUserId,
    addComment,
    deleteComment,
    updateComment,
  } = useEntityComments(scene?.storyId, 'Scene', sceneId);
  const [chapter, setChapter] = useState<Chapter | null>(null); // State for chapter details
  const [location, setLocation] = useState<Location | null>(null); // State for location details
  const [previousScene, setPreviousScene] = useState<SceneSelect | undefined>(undefined); // State for previous scene
  const [nextScene, setNextScene] = useState<SceneSelect | undefined>(undefined); // State for next scene
  const [choicesForScene, setChoicesForScene] = useState<Choice[]>([]); // State for choices leaving this scene
  const [incomingChoicesForScene, setIncomingChoicesForScene] = useState<Choice[]>([]); // State for choices arriving at this scene
  const [sceneNamesById, setSceneNamesById] = useState<Record<string, string>>({}); // For choice target/source scene labels
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
  const [sceneEffects, setSceneEffects] = useState<Effect[]>([]); // State for effects caused by this scene
  const isBranching = selectedStory?.type === 'branching';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  const commonContainerStyles = getCommonContainerStyles(colors);
  const styles = StyleSheet.create({
    ...commonDetailStyleDefs(colors),
    subTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 15,
    },
    locationLink: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      backgroundColor: colors.surface,
    },
    checkRow: { color: colors.text, marginTop: 4 },
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
        setHeaderTitle(fetchedScene.name || copy.detailsTitle);
      } else if (fetchedScene && fetchedScene.isDeleted) {
        navigation.goBack();
      } else {
        setError(copy.notFound);
        setHeaderTitle(copy.notFound);
      }
    } catch (err) {
      console.error('Failed to fetch scene details:', err);
      setError(copy.failedToLoad);
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [sceneId, setScene, setLoading, setError, setHeaderTitle, navigation, copy]);

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
    if (
      !sceneServiceRef.current ||
      !selectedStory?.id ||
      !sceneId ||
      !scene?.chapterId ||
      selectedStory.type !== 'linear'
    ) {
      setPreviousScene(undefined);
      setNextScene(undefined);
      return;
    }
    try {
      const { previousScene, nextScene } = await sceneServiceRef.current.getPreviousNextScenes(
        selectedStory.id,
        sceneId,
        scene.chapterId,
      );
      setPreviousScene(previousScene);
      setNextScene(nextScene);
    } catch (err) {
      console.error('Failed to fetch previous/next scenes:', err);
      setPreviousScene(undefined);
      setNextScene(undefined);
    }
  }, [selectedStory?.id, sceneId, scene?.chapterId, selectedStory?.type]);

  const fetchChoicesForScene = useCallback(async () => {
    if (
      !choiceServiceRef.current ||
      !selectedStory?.id ||
      !sceneId ||
      selectedStory.type !== 'branching'
    ) {
      setChoicesForScene([]);
      return;
    }
    try {
      // `sceneId` is the criterion the service understands, and it filters by the choices that *leave* this
      // scene, which is what the navigation buttons below offer. `fromSceneId` did not exist: it fell into
      // the generic criteria sweep and took the query down.
      const choices = await choiceServiceRef.current.getChoicesByStoryId(
        selectedStory.id,
        undefined,
        undefined,
        undefined,
        undefined,
        { sceneId },
      );
      setChoicesForScene(choices);
    } catch (err) {
      console.error('Failed to fetch choices for scene:', err);
      setChoicesForScene([]);
    }
  }, [selectedStory?.id, sceneId, selectedStory?.type]);

  const fetchIncomingChoicesForScene = useCallback(async () => {
    if (
      !choiceServiceRef.current ||
      !selectedStory?.id ||
      !sceneId ||
      selectedStory.type !== 'branching'
    ) {
      setIncomingChoicesForScene([]);
      return;
    }
    try {
      const choices = await choiceServiceRef.current.getChoicesByStoryId(
        selectedStory.id,
        undefined,
        undefined,
        undefined,
        undefined,
        { nextSceneId: sceneId },
      );
      setIncomingChoicesForScene(choices);
    } catch (err) {
      console.error('Failed to fetch incoming choices for scene:', err);
      setIncomingChoicesForScene([]);
    }
  }, [selectedStory?.id, sceneId, selectedStory?.type]);

  const fetchSceneNames = useCallback(async () => {
    if (!sceneServiceRef.current || !selectedStory?.id || selectedStory.type !== 'branching') {
      setSceneNamesById({});
      return;
    }
    try {
      const allScenes = await sceneServiceRef.current.getAllByStoryId(selectedStory.id);
      setSceneNamesById(Object.fromEntries(allScenes.map((s) => [s.id, s.name])));
    } catch (err) {
      console.error('Failed to fetch scene name lookups:', err);
    }
  }, [selectedStory?.id, selectedStory?.type]);

  const fetchCharacterSceneRelations = useCallback(async () => {
    if (!characterSceneServiceRef.current || !selectedStory?.id || !sceneId) {
      setCharacterSceneRelations([]);
      return;
    }
    try {
      const fetchedRelations = await characterSceneServiceRef.current.getRelationsForScene(
        selectedStory.id,
        sceneId,
      );
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
      const fetchedJourneys = await itemJourneyServiceRef.current.getItemJourneysBySceneId(
        selectedStory.id,
        sceneId,
      );
      setItemJourneys(fetchedJourneys);
    } catch (err) {
      console.error('Failed to fetch item journeys for scene:', err);
    }
  }, [selectedStory?.id, sceneId]);

  const fetchSceneEffects = useCallback(async () => {
    if (!effectServiceRef.current || !selectedStory?.id || !sceneId) {
      setSceneEffects([]);
      return;
    }
    try {
      const fetchedEffects = await effectServiceRef.current.getEffectsByEntity(
        selectedStory.id,
        'Scene',
        sceneId,
      );
      setSceneEffects(fetchedEffects);
    } catch (err) {
      console.error('Failed to fetch scene effects:', err);
    }
  }, [selectedStory?.id, sceneId]);

  const handleEffectChange = useCallback(
    (changedStoryId: string, changedEntityId: string) => {
      if (selectedStory?.id === changedStoryId && changedEntityId === sceneId) {
        fetchSceneEffects();
      }
    },
    [selectedStory?.id, sceneId, fetchSceneEffects],
  );

  const handleItemChange = useCallback(
    (changedStoryId: string, changedItemId: string) => {
      if (selectedStory?.id === changedStoryId) {
        fetchAllItems();
      }
    },
    [selectedStory?.id, fetchAllItems],
  );

  const handleItemJourneyChange = useCallback(
    (changedStoryId: string, changedItemJourneyId: string) => {
      if (selectedStory?.id === changedStoryId) {
        fetchItemJourneysForScene();
      }
    },
    [selectedStory?.id, fetchItemJourneysForScene],
  );

  const handleSceneChange = useCallback(
    async (changedStoryId: string, changedSceneId: string) => {
      if (changedSceneId === sceneId) {
        if (sceneServiceRef.current) {
          const updatedScene = await sceneServiceRef.current.getById(sceneId);
          if (!updatedScene || updatedScene.isDeleted) {
            navigation.goBack();
          } else {
            setScene(updatedScene);
            setHeaderTitle(updatedScene.name || copy.detailsTitle);
          }
        }
        fetchChapter();
        if (selectedStory?.type === 'linear') {
          fetchPreviousNextScenes();
        } else if (selectedStory?.type === 'branching') {
          fetchChoicesForScene();
          fetchIncomingChoicesForScene();
        }
      }
    },
    [
      sceneId,
      navigation,
      setScene,
      setHeaderTitle,
      copy,
      fetchChapter,
      selectedStory?.type,
      fetchPreviousNextScenes,
      fetchChoicesForScene,
      fetchIncomingChoicesForScene,
    ],
  );

  const handleCharacterSceneChange = useCallback(
    (changedStoryId: string, changedSceneId: string) => {
      if (changedSceneId === sceneId) {
        fetchCharacterSceneRelations();
      }
    },
    [sceneId, fetchCharacterSceneRelations],
  );

  // Fetching a scene and subscribing to its auxiliary changes are deliberately separate effects.
  // The handlers below legitimately change when related scene state changes; coupling that to the
  // initial fetch used to fetch and replace `scene` again on every re-subscription.
  useEntityInitialLoad(fetchScene);

  // Notes, note relations and tags are kept fresh by useEntityRelations.
  useEffect(() => {
    if (sceneServiceRef.current) {
      entityEventEmitter.on('scene_changed', handleSceneChange);
      entityEventEmitter.on('character_scene_changed', handleCharacterSceneChange); // Listen for character scene changes
      entityEventEmitter.on('item_changed', handleItemChange); // Listen for item changes
      entityEventEmitter.on('item_journey_changed', handleItemJourneyChange); // Listen for item journey changes
      entityEventEmitter.on('effect_changed', handleEffectChange); // Listen for effect changes

      return () => {
        entityEventEmitter.off('scene_changed', handleSceneChange);
        entityEventEmitter.off('character_scene_changed', handleCharacterSceneChange); // Cleanup listener
        entityEventEmitter.off('item_changed', handleItemChange); // Cleanup listener
        entityEventEmitter.off('item_journey_changed', handleItemJourneyChange); // Cleanup listener
        entityEventEmitter.off('effect_changed', handleEffectChange); // Cleanup listener
      };
    }
  }, [
    handleSceneChange,
    handleCharacterSceneChange,
    handleItemChange,
    handleItemJourneyChange,
    handleEffectChange,
  ]);

  useEffect(() => {
    if (scene) {
      fetchChapter();
      fetchLocation();
      fetchCharacterSceneRelations();
      fetchAllItems(); // Fetch all items when scene changes
      fetchItemJourneysForScene(); // Fetch item journeys for scene when scene changes
      if (isBranching) {
        fetchSceneEffects();
      }
    }
  }, [
    scene,
    fetchChapter,
    fetchLocation,
    fetchCharacterSceneRelations,
    fetchAllItems,
    fetchItemJourneysForScene,
    isBranching,
    fetchSceneEffects,
  ]);

  useEffect(() => {
    if (selectedStory?.type === 'linear' && scene && chapter) {
      fetchPreviousNextScenes();
    } else if (selectedStory?.type === 'branching' && scene) {
      fetchChoicesForScene();
      fetchIncomingChoicesForScene();
      fetchSceneNames();
    }
  }, [
    selectedStory,
    selectedStory?.type,
    scene,
    chapter,
    fetchPreviousNextScenes,
    fetchChoicesForScene,
    fetchIncomingChoicesForScene,
    fetchSceneNames,
  ]);

  const navigateToDetail = useNavigateToEntityDetail();

  const handleLocationPress = useCallback(() => {
    if (!location) return;
    // Location belongs to a sibling Drawer stack. Its own history cannot know that this Scene
    // opened it, so preserve the exact source screen for the shared back handler.
    navigateToDetail('Location', location.id, {
      onReturn: () =>
        navigation.navigate('NarrativeElementsStack', {
          screen: 'SceneDetail',
          params: { sceneId },
        }),
    });
  }, [navigateToDetail, location, navigation, sceneId]);

  const renderHeaderRight = useCallback(
    () =>
      canEdit ? (
        <TouchableOpacity
          onPress={() => navigation.navigate('SceneForm', { sceneId: sceneId })}
          style={{ marginRight: 15 }}
        >
          <Ionicons name="pencil-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      ) : null,
    [navigation, sceneId, colors.text, canEdit],
  );

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: headerTitle,
        headerRight: renderHeaderRight,
      });
      setDocumentTitle(headerTitle);
    }, [navigation, headerTitle, renderHeaderRight]),
  );

  if (loading) {
    return <ScreenLoading padded message={copy.loadingDetails} />;
  }

  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }

  if (!scene) {
    return (
      <ScreenError padded message={copy.dataMissing} onGoBack={() => navigation.goBack()} />
    );
  }

  const describeEffect = (effect: Effect): string => {
    const itemName =
      (effect.itemId && allItems.find((item) => item.id === effect.itemId)?.name) || t('common_na');
    switch (effect.effectType) {
      case 'itemGrant':
        return t('effect_description_item_grant', { item: itemName });
      case 'itemTake':
        return t('effect_description_item_take', { item: itemName });
      case 'triggerSet':
        return t('effect_description_trigger_set', {
          trigger: effect.triggerName || t('common_na'),
        });
      case 'triggerUnset':
        return t('effect_description_trigger_unset', {
          trigger: effect.triggerName || t('common_na'),
        });
      default:
        return '';
    }
  };

  return (
    <ScrollView
      style={commonContainerStyles.container}
      contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
    >
      {chapter ? (
        <Text style={styles.subTitle}>
          {selectedStory?.type === 'linear' ? `${chapter.index}. ` : ''}
          {chapter.name}
        </Text>
      ) : scene && !scene.chapterId ? (
        <Text style={[styles.subTitle, { fontStyle: 'italic' }]}>{t('unchaptered_scenes')}</Text>
      ) : null}
      <TagList tags={sceneTags} variant="chip" emptyMessage={t('no_tags_found')} />
      <CommentableDetailField
        storyId={scene.storyId}
        label={t('summary')}
        value={scene.summary || t('common_na')}
        comments={commentsByField['summary'] ?? []}
        canComment={canComment}
        isStoryOwner={isStoryOwner}
        currentUserId={currentUserId}
        onAddComment={(input) =>
          addComment(
            { fieldKey: 'summary' },
            { ...input, contentSnapshot: scene.summary || t('common_na') },
          )
        }
        onDeleteComment={deleteComment}
        onUpdateComment={updateComment}
      />
      {dateForScene(scene) && (
        <DetailField label={t('calendar_scene_date')} value={dateForScene(scene)!.date} />
      )}
      <DetailField
        label={t('gap')}
        value={`${formatSceneGap(scene, t, {
          normalize: selectedStory?.normalizeSceneTiming,
          calendar,
        })}${dateForScene(scene)?.gapRange ? ` · ${dateForScene(scene)?.gapRange}` : ''}`}
      />
      <DetailField
        label={t('in_universe_duration')}
        value={`${formatSceneUniverseDuration(scene, t, {
          normalize: selectedStory?.normalizeSceneTiming,
          calendar,
        })}${dateForScene(scene)?.durationEnd ? ` · ${dateForScene(scene)?.durationEnd}` : ''}`}
      />

      <CustomAttributeDetailFields storyId={scene.storyId} entityType="Scene" entityId={sceneId} />

      <DetailField
        label={t('is_favorite')}
        value={scene.isFavorite ? t('common_yes') : t('common_no')}
      />
      <CommentableDetailField
        storyId={scene.storyId}
        label={t('extra_notes')}
        value={scene.extraNotes || t('common_na')}
        comments={commentsByField['extraNotes'] ?? []}
        canComment={canComment}
        isStoryOwner={isStoryOwner}
        currentUserId={currentUserId}
        onAddComment={(input) =>
          addComment(
            { fieldKey: 'extraNotes' },
            { ...input, contentSnapshot: scene.extraNotes || t('common_na') },
          )
        }
        onDeleteComment={deleteComment}
        onUpdateComment={updateComment}
      />

      {location && (
        <>
          <Text style={styles.sectionTitle}>{locationCopy.entity}</Text>
          <TouchableOpacity
            onPress={handleLocationPress}
            style={styles.locationLink}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <DetailField label={t('name')} value={location.name} />
              <DetailField
                label={t('description')}
                value={location.description || t('common_na')}
              />
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

      <SceneCharacterManager
        characterRelations={characterSceneRelations}
        availableCharacters={characters.filter((char) => !char.isDeleted)}
        onSave={() => Promise.resolve()}
        onDelete={() => Promise.resolve()}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentSceneId={sceneId}
      />

      <ItemSceneManager
        itemJourneys={itemJourneys}
        allItems={allItems.filter((item) => !item.isDeleted)}
        allCharacters={characters.filter((char) => !char.isDeleted)}
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
        incomingChoicesForScene={incomingChoicesForScene}
        sceneNamesById={sceneNamesById}
        canEdit={canEdit}
        onAddChoice={() => navigation.navigate('ChoiceForm', { sceneId })}
      />

      {isBranching && (
        <>
          <Text style={styles.sectionTitle}>{t('effects_title')}</Text>
          {sceneEffects.length === 0 && (
            <DetailField label={t('effects_title')} value={t('no_effects')} />
          )}
          {sceneEffects.length > 0 && (
            <View style={styles.card}>
              {sceneEffects.map((effect) => (
                <Text key={effect.id} style={styles.checkRow}>{`• ${describeEffect(effect)}`}</Text>
              ))}
            </View>
          )}
        </>
      )}

      <SeeAlsoManager
        storyId={scene.storyId}
        entityType="Scene"
        entityId={sceneId}
        editable={false}
      />

      <FavoritedByList storyId={scene.storyId} entityId={sceneId} entityType="Scene" />

      <EntityMetadata
        version={scene.version}
        createdAt={scene.createdAt}
        updatedAt={scene.updatedAt}
        entityType="Scene"
        entityId={scene.id}
      />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default SceneDetailScreen;
