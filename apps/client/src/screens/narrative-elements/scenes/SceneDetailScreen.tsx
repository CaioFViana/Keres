import { createCommentFieldBindings } from '@/src/components/features/comments/CommentableDetailField/createCommentFieldBindings';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import type { Chapter } from '@keres/shared/entities/Chapter';
import type { CharacterScene } from '@keres/shared/entities/CharacterScene'; // Import CharacterScene entity
import type { Choice } from '@keres/shared/entities/Choice'; // Import Choice
import type { Effect } from '@keres/shared/entities/Effect';
import type { Item, ItemJourney } from '@keres/shared/entities/Item'; // Import Item and ItemJourney
import type { Location } from '@keres/shared/entities/Location'; // Import Location
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import type { SceneSelect } from '../../../db/schema';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useEntityComments } from '../../../hooks/useEntityComments';
import { useEntityRelations } from '../../../hooks/useEntityRelations';
import { useNavigateToEntityDetail } from '../../../hooks/useNavigateToEntityDetail';
import { useOpenGalleryMediaViewer } from '../../../hooks/useOpenGalleryMediaViewer';
import { useStoryRole } from '../../../hooks/useStoryRole';
import { useStoryStore } from '../../../state/storyStore';
import { useVocabularyEntityCopy } from '../../../vocabulary/useVocabularyEntityCopy';
import { useStoryCalendar } from '../../../hooks/useStoryCalendar';
import { useSceneCalendarDates } from '../../../hooks/useSceneCalendarDates';
import {
  useEntityEventSubscriptions,
  useEntityInitialLoad,
} from '../../../hooks/useEntityRefreshLifecycle';
import { useTheme } from '../../../theme';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import type { NarrativeElementsScreenNavigationProp } from '../chapters/NarrativeElementsListScreen';
import { describeEffect } from '../../../utils/choiceCheckEffectDescriptions';
import { SceneDetailContent } from './SceneDetailContent';
import { useSceneDetailServices } from './useSceneDetailServices';

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

  const {
    characters,
    sceneServiceRef,
    chapterServiceRef,
    choiceServiceRef,
    characterSceneServiceRef,
    locationServiceRef,
    itemServiceRef,
    itemJourneyServiceRef,
    effectServiceRef,
  } = useSceneDetailServices(selectedStory?.id);
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

  const styles = StyleSheet.create({
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
  }, [
    sceneServiceRef,
    sceneId,
    setScene,
    setLoading,
    setError,
    setHeaderTitle,
    navigation,
    copy,
    t,
  ]);

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
  }, [chapterServiceRef, scene?.chapterId]);

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
  }, [locationServiceRef, scene?.locationId]);

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
  }, [sceneServiceRef, selectedStory?.id, sceneId, scene?.chapterId, selectedStory?.type]);

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
  }, [choiceServiceRef, selectedStory?.id, sceneId, selectedStory?.type]);

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
  }, [choiceServiceRef, selectedStory?.id, sceneId, selectedStory?.type]);

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
  }, [sceneServiceRef, selectedStory?.id, selectedStory?.type]);

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
  }, [characterSceneServiceRef, selectedStory?.id, sceneId]);

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
  }, [itemServiceRef, selectedStory?.id]);

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
  }, [itemJourneyServiceRef, selectedStory?.id, sceneId]);

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
  }, [effectServiceRef, selectedStory?.id, sceneId]);

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
      sceneServiceRef,
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

  useEntityEventSubscriptions(
    useMemo(
      () => [
        { event: 'scene_changed', listener: handleSceneChange },
        {
          event: 'character_scene_changed',
          listener: handleCharacterSceneChange,
        },
        { event: 'item_changed', listener: handleItemChange },
        { event: 'item_journey_changed', listener: handleItemJourneyChange },
        { event: 'effect_changed', listener: handleEffectChange },
      ],
      [
        handleSceneChange,
        handleCharacterSceneChange,
        handleItemChange,
        handleItemJourneyChange,
        handleEffectChange,
      ],
    ),
  );

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

  useScreenHeader({
    target: 'parent',
    title: headerTitle,
    actions: [
      {
        id: 'action-0',
        icon: 'pencil-outline',
        label: t('edit'),
        onPress: () => navigation.navigate('SceneForm', { sceneId: sceneId }),
        visible: !!canEdit,
      },
    ],
  });

  const itemNamesById = useMemo(
    () => Object.fromEntries(allItems.map((item) => [item.id, item.name])),
    [allItems],
  );

  if (loading) {
    return <ScreenLoading padded message={copy.loadingDetails} />;
  }

  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }

  if (!scene) {
    return <ScreenError padded message={copy.dataMissing} onGoBack={() => navigation.goBack()} />;
  }

  const commentField = createCommentFieldBindings({
    storyId: scene.storyId,
    canComment: canComment,
    isStoryOwner: isStoryOwner,
    currentUserId: currentUserId,
    onDeleteComment: deleteComment,
    onUpdateComment: updateComment,
    commentsByField,
    addComment,
  });

  return (
    <SceneDetailContent
      scene={scene}
      navigation={navigation}
      t={t}
      styles={styles}
      selectedStory={selectedStory}
      chapter={chapter}
      sceneTags={sceneTags}
      commentField={commentField}
      dateForScene={dateForScene}
      calendar={calendar}
      locationCopy={locationCopy}
      location={location}
      handleLocationPress={handleLocationPress}
      colors={colors}
      openGalleryMediaViewer={openGalleryMediaViewer}
      canEdit={canEdit}
      characterSceneRelations={characterSceneRelations}
      characters={characters}
      itemJourneys={itemJourneys}
      allItems={allItems}
      sceneNoteRelations={sceneNoteRelations}
      allNotes={allNotes}
      saveNoteRelation={saveNoteRelation}
      deleteNoteRelation={deleteNoteRelation}
      sceneId={sceneId}
      previousScene={previousScene}
      nextScene={nextScene}
      choicesForScene={choicesForScene}
      incomingChoicesForScene={incomingChoicesForScene}
      sceneNamesById={sceneNamesById}
      isBranching={isBranching}
      sceneEffects={sceneEffects}
      describeEffect={(effect: Effect) => describeEffect(effect, itemNamesById, t)}
    />
  );
};
export default SceneDetailScreen;
