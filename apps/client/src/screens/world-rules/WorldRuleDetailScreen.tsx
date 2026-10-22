import { DetailTabPanels, DetailTabs } from '@/src/components/layout/DetailTabs/DetailTabs';
import { useDetailTab, useDetailTabItems } from '@/src/hooks/nav/useDetailTab';
import Button from '@/src/components/common/controls/Button/Button';
import { createEntityCommentFieldBindings } from '@/src/components/features/comments/CommentableDetailField/createCommentFieldBindings';
import type { OccurrenceTarget } from '@/src/utils/entity/occurrenceTarget';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import EntityMetadata from '@/src/mentions/EntityMetadataWithBacklinks';
import TagList from '@/src/components/common/display/TagList/TagList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import CustomAttributeDetailFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import FavoritedByList from '@/src/components/features/favorites/FavoritedByList/FavoritedByList';
import EntityGalleryManager from '@/src/components/features/gallery/GalleryManager/EntityGalleryManager';
import NoteManager from '@/src/components/features/notes/NoteManager';
import SeeAlsoManager from '@/src/components/features/see-also/SeeAlsoManager/SeeAlsoManager';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useDetailRecord } from '@/src/hooks/lists/useDetailRecord';
import { useEntityComments } from '@/src/hooks/comments/useEntityComments';
import { useEntityRelations } from '@/src/hooks/relations/useEntityRelations';
import { useOpenGalleryMediaViewer } from '@/src/hooks/media/useOpenGalleryMediaViewer';
import { useStoryRole } from '@/src/hooks/story/useStoryRole';
import { useStoryStore } from '@/src/state/story/storyStore';
import { useTheme } from '@/src/theme';

import { useVocabularyEntityCopy } from '@/src/hooks/vocabulary/useVocabularyEntityCopy';
import type { WorldRulesScreenNavigationProp } from './WorldRuleListScreen';
import { useWorldRuleDetailServices } from './useWorldRuleDetailServices';

// Define the parameter list for this screen
export type WorldRuleDetailScreenParamList = {
  WorldRuleDetail: { worldRuleId: string; occurrence?: OccurrenceTarget };
};

const TAG_EVENTS = ['tag_relation_changed'] as const;

type WorldRuleDetailScreenRouteProp = RouteProp<WorldRuleDetailScreenParamList, 'WorldRuleDetail'>;

const WorldRuleDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  useTheme();
  const navigation = useNavigation<WorldRulesScreenNavigationProp>();
  const openGalleryMediaViewer = useOpenGalleryMediaViewer();
  const route = useRoute<WorldRuleDetailScreenRouteProp>();
  const { worldRuleId, occurrence } = route.params;

  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('WorldRule');
  const { selectedStory } = useStoryStore();

  const { worldRuleService } = useWorldRuleDetailServices();
  const {
    record: worldRule,
    loading,
    failure,
  } = useDetailRecord({
    id: worldRuleId,
    load: worldRuleService.getById,
    event: 'worldrule_changed',
    alsoOn: TAG_EVENTS,
    label: 'world rule details',
    onGone: navigation.goBack,
  });
  const { canEdit } = useStoryRole(worldRule?.storyId);
  const comments = useEntityComments(worldRule?.storyId, 'WorldRule', worldRuleId);

  const {
    allNotes,
    noteRelations: worldRuleNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'WorldRule', entityId: worldRuleId });

  const headerTitle = worldRule
    ? worldRule.title || copy.detailsTitle
    : failure === 'notFound'
      ? copy.notFound
      : failure === 'failed'
        ? t('error')
        : t('loading');

  useScreenHeader({
    target: 'parent',
    title: headerTitle,
    actions: [
      {
        id: 'action-0',
        icon: 'pencil-outline',
        label: t('edit'),
        onPress: () => navigation.navigate('WorldRuleForm', { worldRuleId: worldRuleId }),
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

  if (!worldRule) {
    return <ScreenError padded message={copy.dataMissing} onGoBack={() => navigation.goBack()} />;
  }

  const commentField = createEntityCommentFieldBindings(worldRule.storyId, comments);

  const detailsPanel = (
    <>
      <TagList tags={worldRule.tags} variant="chip" emptyMessage={t('no_tags_found')} />

      <CommentableDetailField
        {...commentField('section', t(`world_piece_section_${worldRule.section}`))}
        label={t('world_piece_section')}
      />

      {(['type', 'category', 'behavior', 'usability', 'danger'] as const).map((field) => (
        <CommentableDetailField
          {...commentField(field, worldRule[field] || t('common_na'))}
          key={field}
          label={t(field === 'category' ? 'category' : `world_piece_${field}`)}
        />
      ))}

      <CommentableDetailField
        {...commentField('description', worldRule.description || t('common_na'))}
        label={t('description')}
      />

      <ScreenSection title={t('media_section_title')} />

      <EntityGalleryManager
        ownerId={worldRuleId}
        ownerType="WorldRule"
        onPressMedia={openGalleryMediaViewer}
        editable={canEdit}
      />
    </>
  );

  const relationsPanel = (
    <>
      <NoteManager
        noteRelations={worldRuleNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={worldRuleId}
        currentEntityType="WorldRule"
      />

      <SeeAlsoManager
        storyId={worldRule.storyId}
        entityType="WorldRule"
        entityId={worldRuleId}
        editable={false}
      />
    </>
  );

  const otherPanel = (
    <>
      <CustomAttributeDetailFields
        storyId={worldRule.storyId}
        entityType="WorldRule"
        entityId={worldRuleId}
      />

      <CommentableDetailField
        {...commentField('extraNotes', worldRule.extraNotes || t('common_na'))}
        label={t('extra_notes')}
      />

      <EntityMetadata
        version={worldRule.version}
        createdAt={worldRule.createdAt}
        updatedAt={worldRule.updatedAt}
        entityType="WorldRule"
        entityId={worldRule.id}
      />

      <FavoritedByList storyId={worldRule.storyId} entityId={worldRuleId} entityType="WorldRule" />
    </>
  );

  return (
    <DetailContainer
      title={worldRule.title}
      landing={occurrence ?? null}
      footer={
        <>
          <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
        </>
      }
      tabs={<DetailTabs tabs={tabItems} value={tab} onChange={setTab} />}
      scrollResetKey={tab}
    >
      <DetailTabPanels
        value={tab}
        panels={{ details: detailsPanel, relations: relationsPanel, other: otherPanel }}
      />
    </DetailContainer>
  );
};

export default WorldRuleDetailScreen;
