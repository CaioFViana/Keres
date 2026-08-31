import DetailField from '@/src/components/common/display/DetailField/DetailField';
import EntityMetadata from '@/src/components/features/mentions/EntityMetadataWithBacklinks';
import TagList from '@/src/components/common/display/TagList/TagList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import CustomAttributeDetailFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import FavoritedByList from '@/src/components/features/favorites/FavoritedByList/FavoritedByList';
import AnchorManager from '@/src/components/features/chapters/AnchorManager/AnchorManager';
import ConvertContainerModal from '@/src/components/features/chapters/ConvertContainerModal/ConvertContainerModal';
import NoteManager from '@/src/components/features/notes/NoteManager';
import RelatedScenesList from '@/src/components/features/scenes/RelatedScenesList/RelatedScenesList';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import type { ChapterType } from '@keres/shared';
import { AppAlert } from '@/src/utils/AppAlert';
import { useDrizzle } from '@/src/db';
import type { ChapterSelect, SceneSelect } from '@/src/db/schema'; // Import SceneSelect
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useEntityInitialLoad } from '@/src/hooks/useEntityRefreshLifecycle';
import { useEntityComments } from '@/src/hooks/useEntityComments';
import { useEntityRelations } from '@/src/hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '@/src/hooks/useFormScrollBottomPadding';
import { useStoryRole } from '@/src/hooks/useStoryRole';
import { createChapterService } from '@/src/services/storymanagement/ChapterService';
import { useChapterStore } from '@/src/state/chapterStore';
import type { LocationService } from '@/src/services/storymanagement/LocationService';
import { createLocationService } from '@/src/services/storymanagement/LocationService'; // Import LocationService
import type { SceneService } from '@/src/services/storymanagement/SceneService';
import { createSceneService } from '@/src/services/storymanagement/SceneService'; // Import SceneService
import { useStoryStore } from '@/src/state/storyStore';
import { useStoryCalendar } from '@/src/hooks/useStoryCalendar';
import { useSceneCalendarDates } from '@/src/hooks/useSceneCalendarDates';
import { useTheme } from '@/src/theme';
import { commonDetailStyleDefs, getCommonContainerStyles } from '@/src/theme/commonStyles';
import { setDocumentTitle } from '@/src/utils/documentTitle';
import { entityEventEmitter } from '@/src/utils/EventEmitter';
import {
  formatChapterUniverseDuration,
  formatSceneUniverseDuration,
  hasSceneUniverseDuration,
} from '@/src/utils/sceneTiming';
import { Ionicons } from '@expo/vector-icons';
import type { Location } from '@keres/shared/entities/Location'; // Import Location entity
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { NarrativeElementsScreenNavigationProp } from './NarrativeElementsListScreen';

// Define the parameter list for this screen
export type ChapterDetailScreenParamList = {
  ChapterDetail: { chapterId: string };
};

type ChapterDetailScreenRouteProp = RouteProp<ChapterDetailScreenParamList, 'ChapterDetail'>;

const ChapterDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<NarrativeElementsScreenNavigationProp>();
  const route = useRoute<ChapterDetailScreenRouteProp>();
  const { chapterId } = route.params;
  const { t } = useTranslation();
  const { selectedStory } = useStoryStore();
  const scrollBottomPadding = useFormScrollBottomPadding();

  const drizzleDb = useDrizzle();
  const chapterServiceRef = useRef<ReturnType<typeof createChapterService> | null>(null);
  const sceneServiceRef = useRef<SceneService | null>(null); // Ref for SceneService
  const locationServiceRef = useRef<LocationService | null>(null); // Ref for LocationService

  // Initialize services once when drizzleDb is available
  useEffect(() => {
    if (drizzleDb) {
      if (!chapterServiceRef.current) {
        chapterServiceRef.current = createChapterService(drizzleDb);
      }
      if (!sceneServiceRef.current) {
        sceneServiceRef.current = createSceneService(drizzleDb);
      }
      if (!locationServiceRef.current) {
        locationServiceRef.current = createLocationService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  const [chapter, setChapter] = useState<ChapterSelect | null>(null);
  const { canEdit } = useStoryRole(chapter?.storyId);
  const { definition: calendar } = useStoryCalendar();
  const { dateForScene } = useSceneCalendarDates(selectedStory?.id);
  const {
    commentsByField,
    canComment,
    isStoryOwner,
    currentUserId,
    addComment,
    deleteComment,
    updateComment,
  } = useEntityComments(chapter?.storyId, 'Chapter', chapterId);

  const {
    selectedTags: chapterTags,
    allNotes,
    noteRelations: chapterNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Chapter', entityId: chapterId });

  const [allScenes, setAllScenes] = useState<SceneSelect[]>([]); // State for for all scenes in story
  const [allLocations, setAllLocations] = useState<Location[]>([]); // State for all locations in story
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
  });

  const fetchChapter = useCallback(async () => {
    if (!chapterServiceRef.current) {
      console.warn('Chapter service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedChapter = await chapterServiceRef.current.getById(chapterId);
      if (fetchedChapter && !fetchedChapter.isDeleted) {
        setChapter(fetchedChapter);
        setHeaderTitle(fetchedChapter.name || t('chapter_details_title'));
      } else if (fetchedChapter && fetchedChapter.isDeleted) {
        navigation.goBack();
      } else {
        setError(t('chapter_not_found'));
        setHeaderTitle(t('chapter_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch chapter details:', err);
      setError(t('failed_to_load_chapter'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [chapterId, setChapter, setLoading, setError, setHeaderTitle, navigation, t]);

  const fetchAllScenesInStory = useCallback(async () => {
    if (!sceneServiceRef.current || !selectedStory?.id) {
      setAllScenes([]);
      return;
    }
    try {
      const fetchedScenes = await sceneServiceRef.current.getScenesByStoryId(selectedStory.id);
      setAllScenes(fetchedScenes.filter((s) => !s.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all scenes:', err);
    }
  }, [selectedStory?.id]);

  const fetchAllLocationsInStory = useCallback(async () => {
    if (!locationServiceRef.current || !selectedStory?.id) {
      setAllLocations([]);
      return;
    }
    try {
      const fetchedLocations = await locationServiceRef.current.getAllByStoryId(selectedStory.id);
      setAllLocations(fetchedLocations.filter((l) => !l.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all locations:', err);
    }
  }, [selectedStory?.id]);

  const handleChapterChange = useCallback(
    async (changedStoryId: string, changedChapterId: string) => {
      if (changedChapterId === chapterId) {
        if (chapterServiceRef.current) {
          const updatedChapter = await chapterServiceRef.current.getById(chapterId);
          if (!updatedChapter || updatedChapter.isDeleted) {
            navigation.goBack();
          } else {
            setChapter(updatedChapter);
            setHeaderTitle(updatedChapter.name || t('chapter_details_title'));
          }
        }
      }
    },
    [chapterId, navigation, setChapter, setHeaderTitle, t],
  );

  const handleSceneChange = useCallback(
    (changedStoryId: string, changedSceneId: string) => {
      if (selectedStory?.id === changedStoryId) {
        fetchAllScenesInStory();
      }
    },
    [selectedStory?.id, fetchAllScenesInStory],
  );

  const handleLocationChange = useCallback(
    (changedStoryId: string, changedLocationId: string) => {
      if (selectedStory?.id === changedStoryId) {
        fetchAllLocationsInStory();
      }
    },
    [selectedStory?.id, fetchAllLocationsInStory],
  );

  useEntityInitialLoad(fetchChapter);

  // Re-subscribing after a callback changes must not reload the chapter.
  useEffect(() => {
    if (chapterServiceRef.current) {
      entityEventEmitter.on('chapter_changed', handleChapterChange);
      entityEventEmitter.on('scene_changed', handleSceneChange); // Listen for scene changes
      entityEventEmitter.on('location_changed', handleLocationChange); // Listen for location changes

      return () => {
        entityEventEmitter.off('chapter_changed', handleChapterChange);
        entityEventEmitter.off('scene_changed', handleSceneChange); // Cleanup listener
        entityEventEmitter.off('location_changed', handleLocationChange); // Cleanup listener
      };
    }
  }, [handleChapterChange, handleSceneChange, handleLocationChange]);

  useEffect(() => {
    if (chapter) {
      fetchAllScenesInStory(); // Fetch all scenes
      fetchAllLocationsInStory(); // Fetch all locations
    }
  }, [chapter, fetchAllScenesInStory, fetchAllLocationsInStory]);

  const [isConvertVisible, setIsConvertVisible] = useState(false);
  const [spine, setSpine] = useState<{ id: string; name: string }[]>([]);
  const convertChapterType = useChapterStore((state) => state.convertChapterType);

  /** The spine as it stands, so the modal can offer the slots a returning chapter may take. */
  useEffect(() => {
    if (!isConvertVisible || !chapter) return;
    createChapterService(drizzleDb)
      .getAllByStoryId(chapter.storyId, 'chapter')
      .then((rows) =>
        setSpine(
          rows.filter((row) => row.id !== chapterId).map((row) => ({ id: row.id, name: row.name })),
        ),
      )
      .catch((error) => console.error('ChapterDetailScreen: failed to read the spine.', error));
  }, [isConvertVisible, chapter, chapterId, drizzleDb]);

  const renderHeaderRight = useCallback(
    () =>
      canEdit ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/*
            Changing the kind is not an edit to a field: it moves the container between two index
            spaces and renumbers both. It sits beside the pencil rather than inside the form for
            that reason - see `ChapterService.convertChapterType`.
          */}
          <TouchableOpacity
            onPress={() => setIsConvertVisible(true)}
            style={{ marginRight: 15 }}
            accessibilityLabel={
              chapter?.type === 'event'
                ? t('chapter_convert_to_chapter')
                : t('chapter_convert_to_event')
            }
            testID="convert-container"
          >
            <Ionicons
              name={chapter?.type === 'event' ? 'book-outline' : 'hourglass-outline'}
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('ChapterForm', { chapterId: chapterId })}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="pencil-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      ) : null,
    [navigation, chapterId, colors.text, canEdit, chapter?.type, t],
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
    return <ScreenLoading padded message={t('loading_chapter_details')} />;
  }

  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }

  if (!chapter) {
    return (
      <ScreenError
        padded
        message={t('chapter_data_missing')}
        onGoBack={() => navigation.goBack()}
      />
    );
  }

  return (
    <ScrollView
      style={commonContainerStyles.container}
      contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
    >
      <TagList tags={chapterTags} variant="chip" emptyMessage={t('no_tags_found')} />
      <CommentableDetailField
        storyId={chapter.storyId}
        label={t('summary')}
        value={chapter.summary || t('common_na')}
        comments={commentsByField['summary'] ?? []}
        canComment={canComment}
        isStoryOwner={isStoryOwner}
        currentUserId={currentUserId}
        onAddComment={(input) =>
          addComment(
            { fieldKey: 'summary' },
            { ...input, contentSnapshot: chapter.summary || t('common_na') },
          )
        }
        onDeleteComment={deleteComment}
        onUpdateComment={updateComment}
      />
      {selectedStory?.type === 'linear' && (
        <>
          {allScenes
            .filter((scene) => scene.chapterId === chapterId)
            .sort((a, b) => a.index - b.index)
            .slice(0, 1)
            .map((scene) =>
              dateForScene(scene) ? (
                <DetailField
                  key="calendar-date"
                  label={t('calendar_chapter_date')}
                  value={dateForScene(scene)!.date}
                />
              ) : null,
            )}
          <DetailField
            label={t('in_universe_duration')}
            value={formatChapterUniverseDuration(
              allScenes
                .filter((scene) => scene.chapterId === chapterId)
                .sort((a, b) => a.index - b.index),
              t,
              { normalize: selectedStory.normalizeSceneTiming, calendar },
            )}
          />
        </>
      )}

      <CustomAttributeDetailFields
        storyId={chapter.storyId}
        entityType="Chapter"
        entityId={chapterId}
      />

      <DetailField
        label={t('is_favorite')}
        value={chapter.isFavorite ? t('common_yes') : t('common_no')}
      />
      <CommentableDetailField
        storyId={chapter.storyId}
        label={t('extra_notes')}
        value={chapter.extraNotes || t('common_na')}
        comments={commentsByField['extraNotes'] ?? []}
        canComment={canComment}
        isStoryOwner={isStoryOwner}
        currentUserId={currentUserId}
        onAddComment={(input) =>
          addComment(
            { fieldKey: 'extraNotes' },
            { ...input, contentSnapshot: chapter.extraNotes || t('common_na') },
          )
        }
        onDeleteComment={deleteComment}
        onUpdateComment={updateComment}
      />

      <AnchorManager
        storyId={chapter.storyId}
        chapterId={chapterId}
        currentUserId={currentUserId}
        editable={false}
      />

      <RelatedScenesList
        showChapter={false}
        scenes={allScenes}
        matchesScene={(scene) => scene.chapterId === chapterId}
        sortScenes={(a, b) => a.index - b.index}
        title={t('scenes_in_chapter_title')}
        noItemsMessage="no_scenes_in_chapter"
        getDetails={(scene) => {
          const details = scene.summary ? [{ label: t('summary'), value: scene.summary }] : [];
          if (hasSceneUniverseDuration(scene)) {
            details.push({
              label: t('in_universe_duration'),
              value: formatSceneUniverseDuration(scene, t, {
                normalize: selectedStory?.normalizeSceneTiming,
                calendar,
              }),
            });
          }
          const sceneDate = dateForScene(scene);
          if (sceneDate) details.push({ label: t('calendar_scene_date'), value: sceneDate.date });
          const locationName = allLocations.find(
            (location) => location.id === scene.locationId,
          )?.name;
          return locationName
            ? [...details, { label: t('location'), value: locationName }]
            : details;
        }}
      />

      <NoteManager
        noteRelations={chapterNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={chapterId}
        currentEntityType="Chapter"
      />

      <SeeAlsoManager
        storyId={chapter.storyId}
        entityType="Chapter"
        entityId={chapterId}
        editable={false}
      />

      <FavoritedByList storyId={chapter.storyId} entityId={chapterId} entityType="Chapter" />

      <EntityMetadata
        version={chapter.version}
        createdAt={chapter.createdAt}
        updatedAt={chapter.updatedAt}
        entityType="Chapter"
        entityId={chapter.id}
      />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>

      <ConvertContainerModal
        visible={isConvertVisible}
        name={chapter.name}
        currentType={chapter.type}
        chapterNames={spine}
        onCancel={() => setIsConvertVisible(false)}
        onConfirm={async (targetType: ChapterType, position?: number) => {
          setIsConvertVisible(false);
          try {
            await convertChapterType(chapterId, targetType, position);
          } catch (error) {
            // The store swallows and records the error; without this the writer sees the modal
            // close and nothing else happen, which reads as the app ignoring them.
            console.error('ChapterDetailScreen: failed to convert the container.', error);
            AppAlert.alert(t('error'), t('chapter_convert_failed'));
          }
        }}
      />
    </ScrollView>
  );
};

export default ChapterDetailScreen;
