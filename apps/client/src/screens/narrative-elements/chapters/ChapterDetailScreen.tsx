import { DetailTabPanels, DetailTabs } from '@/src/components/layout/DetailTabs/DetailTabs';
import { useDetailTab, useDetailTabItems } from '@/src/hooks/nav/useDetailTab';
import Button from '@/src/components/common/controls/Button/Button';
import { createEntityCommentFieldBindings } from '@/src/components/features/comments/CommentableDetailField/createCommentFieldBindings';
import type { OccurrenceTarget } from '@/src/utils/entity/occurrenceTarget';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import EntityMetadata from '@/src/mentions/EntityMetadataWithBacklinks';
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
import SeeAlsoManager from '@/src/components/features/see-also/SeeAlsoManager/SeeAlsoManager';
import type { ChapterType } from '@keres/shared';
import { AppAlert } from '@/src/state/ui/AppAlert';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useDetailRecord } from '@/src/hooks/lists/useDetailRecord';
import { useStoryEntities } from '@/src/hooks/lists/useStoryEntities';
import { useEntityComments } from '@/src/hooks/comments/useEntityComments';
import { useEntityRelations } from '@/src/hooks/relations/useEntityRelations';
import { useStoryArcs } from '@/src/hooks/story/useStoryArcs';
import { useStoryRole } from '@/src/hooks/story/useStoryRole';
import { useChapterStore } from '@/src/state/story/chapterStore';
import { useStoryStore } from '@/src/state/story/storyStore';
import { useStoryCalendar } from '@/src/hooks/story/useStoryCalendar';
import { useSceneCalendarDates } from '@/src/hooks/scene/useSceneCalendarDates';
import { type ThemeColors } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { commonDetailStyleDefs } from '@/src/theme/commonStyles';
import { useVocabularyEntityCopy } from '@/src/hooks/vocabulary/useVocabularyEntityCopy';
import { useStoryVocabulary } from '@/src/hooks/vocabulary/useStoryVocabulary';
import {
  formatChapterUniverseDuration,
  formatSceneUniverseDuration,
  hasSceneUniverseDuration,
} from '@/src/utils/scene/sceneTiming';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import type { NarrativeElementsScreenNavigationProp } from './NarrativeElementsListScreen';
import { logger } from '@/src/utils/logging/logger';
import { useChapterDetailServices } from './useChapterDetailServices';

export type ChapterDetailScreenParamList = {
  ChapterDetail: { chapterId: string; occurrence?: OccurrenceTarget };
};

const SCENE_EVENTS = ['scene_changed'] as const;
const LOCATION_EVENTS = ['location_changed'] as const;

type ChapterDetailScreenRouteProp = RouteProp<ChapterDetailScreenParamList, 'ChapterDetail'>;

const ChapterDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const navigation = useNavigation<NarrativeElementsScreenNavigationProp>();
  const route = useRoute<ChapterDetailScreenRouteProp>();
  const { chapterId, occurrence } = route.params;
  const { t } = useTranslation();
  const locationCopy = useVocabularyEntityCopy('Location');
  const eventCopy = useVocabularyEntityCopy('Event');
  const chapterNounCopy = useVocabularyEntityCopy('Chapter');
  const vocab = useStoryVocabulary();
  const { arcs, showSelector } = useStoryArcs();
  const { selectedStory } = useStoryStore();

  const { chapterService, sceneService, locationService } = useChapterDetailServices();
  const {
    record: chapter,
    loading,
    failure,
  } = useDetailRecord({
    id: chapterId,
    load: chapterService.getById,
    event: 'chapter_changed',
    label: 'chapter details',
    onGone: navigation.goBack,
  });
  const copy = useVocabularyEntityCopy(chapter?.type === 'event' ? 'Event' : 'Chapter');
  const { canEdit } = useStoryRole(chapter?.storyId);
  const { definition: calendar } = useStoryCalendar();
  const { dateForScene } = useSceneCalendarDates(selectedStory?.id);
  const comments = useEntityComments(chapter?.storyId, 'Chapter', chapterId);

  const {
    selectedTags: chapterTags,
    allNotes,
    noteRelations: chapterNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Chapter', entityId: chapterId });

  const allScenes = useStoryEntities({
    storyId: selectedStory?.id,
    enabled: chapter !== null,
    load: sceneService.getScenesByStoryId,
    events: SCENE_EVENTS,
    label: 'all scenes',
  });
  const allLocations = useStoryEntities({
    storyId: selectedStory?.id,
    enabled: chapter !== null,
    load: locationService.getAllByStoryId,
    events: LOCATION_EVENTS,
    label: 'all locations',
  });

  const styles = useThemedStyles(createStyles);

  const headerTitle = chapter
    ? chapter.name || copy.detailsTitle
    : failure === 'notFound'
      ? copy.notFound
      : failure === 'failed'
        ? t('error')
        : t('loading');

  const [isConvertVisible, setIsConvertVisible] = useState(false);
  const [spine, setSpine] = useState<{ id: string; name: string }[]>([]);
  const convertChapterType = useChapterStore((state) => state.convertChapterType);

  /** The spine as it stands, so the modal can offer the slots a returning chapter may take. */
  useEffect(() => {
    if (!isConvertVisible || !chapter) return;
    chapterService
      .getAllByStoryId(chapter.storyId, 'chapter')
      .then((rows) =>
        setSpine(
          rows.filter((row) => row.id !== chapterId).map((row) => ({ id: row.id, name: row.name })),
        ),
      )
      .catch((error) => logger.error('ChapterDetailScreen: failed to read the spine.', error));
  }, [isConvertVisible, chapter, chapterId, chapterService]);

  useScreenHeader({
    target: 'parent',
    title: headerTitle,
    actions: [
      {
        id: 'action-0',
        icon: chapter?.type === 'event' ? 'book-outline' : 'hourglass-outline',
        label: chapter?.type === 'event' ? chapterNounCopy.convertTo : eventCopy.convertTo,
        onPress: () => setIsConvertVisible(true),
        visible: !!canEdit,
      },
      {
        id: 'action-1',
        icon: 'pencil-outline',
        label: t('edit'),
        onPress: () => navigation.navigate('ChapterForm', { chapterId: chapterId }),
        visible: !!canEdit,
      },
    ],
  });

  const [tab, setTab] = useDetailTab(occurrence);
  const tabItems = useDetailTabItems(t);

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

  if (!chapter) {
    return <ScreenError padded message={copy.dataMissing} onGoBack={() => navigation.goBack()} />;
  }

  const commentField = createEntityCommentFieldBindings(chapter.storyId, comments);

  const detailsPanel = (
    <>
      <TagList tags={chapterTags} variant="chip" emptyMessage={t('no_tags_found')} />

      <CommentableDetailField
        {...commentField('summary', chapter.summary || t('common_na'))}
        label={t('summary')}
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

      {showSelector ? (
        <DetailField
          label={vocab.term('Arc')}
          value={arcs.find((arc) => arc.id === chapter.arcId)?.title || t('common_na')}
        />
      ) : null}
    </>
  );

  const relationsPanel = (
    <>
      <AnchorManager
        storyId={chapter.storyId}
        chapterId={chapterId}
        currentUserId={comments.currentUserId}
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
            ? [...details, { label: locationCopy.entity, value: locationName }]
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
    </>
  );

  const otherPanel = (
    <>
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
        {...commentField('extraNotes', chapter.extraNotes || t('common_na'))}
        label={t('extra_notes')}
      />

      <FavoritedByList storyId={chapter.storyId} entityId={chapterId} entityType="Chapter" />

      <EntityMetadata
        version={chapter.version}
        createdAt={chapter.createdAt}
        updatedAt={chapter.updatedAt}
        entityType="Chapter"
        entityId={chapter.id}
      />
    </>
  );

  return (
    <DetailContainer
      title={chapter.name}
      landing={occurrence ?? null}
      tabs={<DetailTabs tabs={tabItems} value={tab} onChange={setTab} />}
      scrollResetKey={tab}
    >
      <DetailTabPanels
        value={tab}
        panels={{ details: detailsPanel, relations: relationsPanel, other: otherPanel }}
      />

      <View style={styles.buttonContainer}>
        <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
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
            logger.error('ChapterDetailScreen: failed to convert the container.', error);
            AppAlert.alert(t('error'), t('chapter_convert_failed'));
          }
        }}
      />
    </DetailContainer>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({ ...commonDetailStyleDefs(colors) });

export default ChapterDetailScreen;
