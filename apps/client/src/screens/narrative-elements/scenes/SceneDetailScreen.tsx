import { createCommentFieldBindings } from '@/src/components/features/comments/CommentableDetailField/createCommentFieldBindings';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import type { Effect } from '@keres/shared/entities/narrative/Effect';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { stripManuscriptMarkers } from '@keres/shared';
import { readStoredSceneBodyText } from '@/src/screens/narrative-elements/scenes/useSceneBodyDraft';
import { useEntityComments } from '@/src/hooks/comments/useEntityComments';
import { useEntityRelations } from '@/src/hooks/relations/useEntityRelations';
import { useNavigateToEntityDetail } from '@/src/hooks/nav/useNavigateToEntityDetail';
import { useOpenGalleryMediaViewer } from '@/src/hooks/media/useOpenGalleryMediaViewer';
import { useStoryRole } from '@/src/hooks/story/useStoryRole';
import { useStoryStore } from '@/src/state/story/storyStore';
import { useVocabularyEntityCopy } from '@/src/hooks/vocabulary/useVocabularyEntityCopy';
import { useStoryCalendar } from '@/src/hooks/story/useStoryCalendar';
import { sceneFixedDate } from '@/src/utils/scene/sceneFixedDate';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { useSceneCalendarDates } from '@/src/hooks/scene/useSceneCalendarDates';
import { useDetailRecord } from '@/src/hooks/lists/useDetailRecord';
import { type ThemeColors, useTheme } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import type { NarrativeElementsStackParamList } from '@/src/navigation/drawer/MainSystemDrawer';
import type { NarrativeElementsScreenNavigationProp } from '@/src/screens/narrative-elements/chapters/NarrativeElementsListScreen';
import { describeEffect } from '@/src/utils/analysis/choiceCheckEffectDescriptions';
import { SceneDetailContent } from './SceneDetailContent';
import { useSceneDetailLists } from './useSceneDetailLists';
import { useSceneDetailServices } from './useSceneDetailServices';

type SceneDetailScreenRouteProp = RouteProp<NarrativeElementsStackParamList, 'SceneDetail'>;

const MANUSCRIPT_EXCERPT_LENGTH = 150;

// Card preview of the prose: markup-stripped, collapsed to one line and truncated with an
// ellipsis. Null when nothing readable was written, so the entry falls back to its empty copy.
function excerptBody(body: string | null | undefined): string | null {
  if (!body) return null;
  const normalized = stripManuscriptMarkers(body).replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return normalized.length > MANUSCRIPT_EXCERPT_LENGTH
    ? `${normalized.slice(0, MANUSCRIPT_EXCERPT_LENGTH)}…`
    : normalized;
}

const SceneDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const { definition: calendar, calendars } = useStoryCalendar();
  const navigation = useNavigation<NarrativeElementsScreenNavigationProp>();
  const openGalleryMediaViewer = useOpenGalleryMediaViewer();
  const route = useRoute<SceneDetailScreenRouteProp>();
  const { sceneId, occurrence } = route.params;
  const { t, i18n } = useTranslation();
  const dateDisplayFormat = useUserSettingsStore((state) => state.dateDisplayFormat);
  const use24HourTime = useUserSettingsStore((state) => state.use24HourTime);
  const copy = useVocabularyEntityCopy('Scene');
  const locationCopy = useVocabularyEntityCopy('Location');
  const { selectedStory } = useStoryStore();
  const { dateForScene } = useSceneCalendarDates(selectedStory?.id);

  const services = useSceneDetailServices(selectedStory?.id);
  const { characters } = services;
  const {
    record: scene,
    loading,
    failure,
  } = useDetailRecord({
    id: sceneId,
    load: services.sceneService.getById,
    event: 'scene_changed',
    label: 'scene details',
    onGone: navigation.goBack,
  });
  const { canEdit } = useStoryRole(scene?.storyId);
  const { commentsByField, canComment, isStoryOwner, currentUserId, addComment, deleteComment } =
    useEntityComments(scene?.storyId, 'Scene', sceneId);
  const {
    selectedTags: sceneTags,
    allNotes,
    noteRelations: sceneNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Scene', entityId: sceneId });
  const isBranching = selectedStory?.type === 'branching';
  const {
    chapter,
    location,
    previousScene,
    nextScene,
    choicesForScene,
    incomingChoicesForScene,
    sceneNamesById,
    characterSceneRelations,
    allItems,
    itemJourneys,
    sceneEffects,
  } = useSceneDetailLists(services, {
    storyId: selectedStory?.id,
    sceneId,
    chapterId: scene?.chapterId,
    locationId: scene?.locationId,
    enabled: scene !== null,
    isLinear: selectedStory?.type === 'linear',
    isBranching,
  });
  const [hasBodyDraft, setHasBodyDraft] = useState(false);

  const styles = useThemedStyles(createStyles);

  const headerTitle = scene
    ? scene.name || copy.detailsTitle
    : failure === 'notFound'
      ? copy.notFound
      : failure === 'failed'
        ? t('error')
        : t('loading');

  // The draft flag refreshes on focus too: leaving the editor without saving emits no
  // scene event, so data alone would leave a stale indicator behind.
  // The flag means "a stored draft exists AND differs from the saved body": a draft that
  // already matches (saved elsewhere, then revisited) reads clean, and corrupt or missing
  // rows read as no flag rather than failing the screen.
  const refreshBodyDraftFlag = useCallback(async () => {
    if (!scene?.storyId) {
      setHasBodyDraft(false);
      return;
    }
    const draft = await readStoredSceneBodyText(scene.storyId, sceneId);
    setHasBodyDraft(!!draft && draft !== (scene.body ?? ''));
  }, [scene?.storyId, scene?.body, sceneId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `refreshBodyDraftFlag` clears synchronously only when no scene is loaded; everything else waits for `await`. The rule cannot verify across the callback boundary.
    void refreshBodyDraftFlag();
  }, [refreshBodyDraftFlag]);

  useFocusEffect(
    useCallback(() => {
      void refreshBodyDraftFlag();
    }, [refreshBodyDraftFlag]),
  );

  const openEditor = useCallback(() => {
    navigation.navigate('SceneEditor', { sceneId });
  }, [navigation, sceneId]);

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
      {
        id: 'open-editor',
        icon: 'document-text-outline',
        label: t('manuscript_open_editor'),
        onPress: openEditor,
        visible: !!scene,
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

  if (failure) {
    return (
      <ScreenError
        padded
        message={failure === 'notFound' ? copy.notFound : copy.failedToLoad}
        onGoBack={() => navigation.goBack()}
      />
    );
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
      manuscriptExcerpt={excerptBody(scene.body)}
      hasBodyDraft={hasBodyDraft}
      onOpenEditor={openEditor}
      dateForScene={dateForScene}
      calendar={calendar}
      fixedDate={sceneFixedDate(scene, {
        calendars,
        language: i18n.language,
        format: dateDisplayFormat,
        use24HourTime,
        labels: {
          gregorian: t('calendar_standard_title'),
          notValid: t('scene_fixed_date_not_valid'),
          am: t('attribute_date_am'),
          pm: t('attribute_date_pm'),
        },
      })}
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
      occurrence={occurrence}
    />
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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

export default SceneDetailScreen;
