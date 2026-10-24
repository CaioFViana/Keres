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
import RelatedEntitiesList from '@/src/components/common/lists/RelatedEntitiesList/RelatedEntitiesList';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import FavoritedByList from '@/src/components/features/favorites/FavoritedByList/FavoritedByList';
import EntityGalleryManager from '@/src/components/features/gallery/GalleryManager/EntityGalleryManager';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useDetailRecord } from '@/src/hooks/lists/useDetailRecord';
import { useEntityComments } from '@/src/hooks/comments/useEntityComments';
import { useOpenGalleryMediaViewer } from '@/src/hooks/media/useOpenGalleryMediaViewer';
import { useStoryRole } from '@/src/hooks/story/useStoryRole';
import { useTheme } from '@/src/theme';

import type { NotesScreenNavigationProp } from './NoteListScreen';
import { useNoteDetailRelations } from './useNoteDetailRelations';
import { useNoteDetailServices } from './useNoteDetailServices';

// Define the parameter list for this screen
export type NoteDetailScreenParamList = {
  NoteDetail: { noteId: string; occurrence?: OccurrenceTarget };
};

type NoteDetailScreenRouteProp = RouteProp<NoteDetailScreenParamList, 'NoteDetail'>;

const NoteDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  useTheme();
  const navigation = useNavigation<NotesScreenNavigationProp>();
  const openGalleryMediaViewer = useOpenGalleryMediaViewer();
  const route = useRoute<NoteDetailScreenRouteProp>();
  const { noteId, occurrence } = route.params;

  const { t } = useTranslation();

  const services = useNoteDetailServices();
  const {
    record: note,
    loading,
    failure,
  } = useDetailRecord({
    id: noteId,
    load: services.noteService.getById,
    event: 'note_changed',
    label: 'note details',
    onGone: navigation.goBack,
  });
  const { canEdit } = useStoryRole(note?.storyId);
  const comments = useEntityComments(note?.storyId, 'Note', noteId);
  const { tags: noteTags, groupedEntities } = useNoteDetailRelations(
    services,
    note?.storyId,
    noteId,
  );

  const headerTitle = note
    ? note.title || t('note_details_title')
    : failure === 'notFound'
      ? t('note_not_found')
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
        onPress: () => navigation.navigate('NoteForm', { noteId: noteId }),
        visible: !!canEdit,
      },
    ],
  });

  const [tab, setTab] = useDetailTab(occurrence);
  const tabItems = useDetailTabItems(t);

  if (loading) {
    return <ScreenLoading padded message={t('loading_note_details')} />;
  }

  if (failure) {
    return (
      <ScreenError
        padded
        message={failure === 'notFound' ? t('note_not_found') : t('failed_to_load_note')}
        onGoBack={() => navigation.goBack()}
      />
    );
  }

  if (!note) {
    return (
      <ScreenError padded message={t('note_data_missing')} onGoBack={() => navigation.goBack()} />
    );
  }

  const commentField = createEntityCommentFieldBindings(note.storyId, comments);

  const detailsPanel = (
    <>
      <TagList tags={noteTags} variant="chip" emptyMessage={t('no_tags_found')} />

      <CommentableDetailField
        {...commentField('body', note.body || t('common_na'))}
        label={t('body')}
      />

      <ScreenSection title={t('media_section_title')} />

      <EntityGalleryManager
        ownerId={noteId}
        ownerType="Note"
        onPressMedia={openGalleryMediaViewer}
        editable={canEdit}
      />
    </>
  );

  const relationsPanel = (
    <>
      <RelatedEntitiesList
        title={t('related_entities_title')}
        noItemsMessage={t('no_entities_related')}
        groupedEntities={groupedEntities}
      />
    </>
  );

  const otherPanel = (
    <>
      <CustomAttributeDetailFields storyId={note.storyId} entityType="Note" entityId={noteId} />

      <CommentableDetailField
        {...commentField('extraNotes', note.extraNotes || t('common_na'))}
        label={t('extra_notes')}
      />

      <FavoritedByList storyId={note.storyId} entityId={noteId} entityType="Note" />

      <EntityMetadata
        version={note.version}
        createdAt={note.createdAt}
        updatedAt={note.updatedAt}
        entityType="Note"
        entityId={note.id}
      />
    </>
  );

  return (
    <DetailContainer
      title={note.title}
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

export default NoteDetailScreen;
