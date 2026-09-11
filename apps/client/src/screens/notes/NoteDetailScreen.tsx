import Button from '@/src/components/common/controls/Button/Button';
import { createCommentFieldBindings } from '@/src/components/features/comments/CommentableDetailField/createCommentFieldBindings';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import EntityMetadata from '@/src/components/features/mentions/EntityMetadataWithBacklinks';
import TagList from '@/src/components/common/display/TagList/TagList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import CustomAttributeDetailFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields';
import type { RelatedEntityItem } from '@/src/components/common/lists/RelatedEntitiesList/RelatedEntitiesList';
import RelatedEntitiesList from '@/src/components/common/lists/RelatedEntitiesList/RelatedEntitiesList';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import FavoritedByList from '@/src/components/features/favorites/FavoritedByList/FavoritedByList';
import EntityGalleryManager from '@/src/components/features/gallery/GalleryManager/EntityGalleryManager';
import { createNoteRelationService } from '@/src/services/storymanagement/NoteRelationService';
import type { NoteRelation } from '@keres/shared/entities/Note'; // Import NoteRelation
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDrizzle } from '../../db';
import type { TagSelect } from '../../db/schema';
import type { NoteSelect } from '../../db/schemas/notes';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import {
  useEntityEventSubscriptions,
  useEntityInitialLoad,
} from '../../hooks/useEntityRefreshLifecycle';
import { useEntityComments } from '../../hooks/useEntityComments';
import { useOpenGalleryMediaViewer } from '../../hooks/useOpenGalleryMediaViewer';
import { useStoryRole } from '../../hooks/useStoryRole';
import { EntityService } from '../../services/EntityService'; // Import EntityService
import { createNoteService } from '../../services/storymanagement/NoteService';
import { createTagRelationService } from '../../services/storymanagement/TagRelationService';
import { createTagService } from '../../services/storymanagement/TagService';
import { useStoryStore } from '../../state/storyStore'; // Import useStoryStore
import { useTheme } from '../../theme';

import type { NotesScreenNavigationProp } from './NoteListScreen';

// Define the parameter list for this screen
export type NoteDetailScreenParamList = {
  NoteDetail: { noteId: string };
};

type NoteDetailScreenRouteProp = RouteProp<NoteDetailScreenParamList, 'NoteDetail'>;

const NoteDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  useTheme();
  const navigation = useNavigation<NotesScreenNavigationProp>();
  const openGalleryMediaViewer = useOpenGalleryMediaViewer();
  const route = useRoute<NoteDetailScreenRouteProp>();
  const { noteId } = route.params;

  const drizzleDb = useDrizzle();
  const noteServiceRef = useRef<ReturnType<typeof createNoteService> | null>(null);
  const noteRelationServiceRef = useRef<ReturnType<typeof createNoteRelationService> | null>(null); // Added this line
  const tagServiceRef = useRef<ReturnType<typeof createTagService> | null>(null);
  const tagRelationServiceRef = useRef<ReturnType<typeof createTagRelationService> | null>(null);
  const { t } = useTranslation();
  const { selectedStory } = useStoryStore();

  // Initialize services only once when drizzleDb is available
  useEffect(() => {
    if (drizzleDb) {
      if (!noteServiceRef.current) {
        noteServiceRef.current = createNoteService(drizzleDb);
      }
      if (!tagServiceRef.current) {
        tagServiceRef.current = createTagService(drizzleDb);
      }
      if (!tagRelationServiceRef.current) {
        tagRelationServiceRef.current = createTagRelationService(drizzleDb);
      }
      if (!noteRelationServiceRef.current) {
        noteRelationServiceRef.current = createNoteRelationService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  const [note, setNote] = useState<NoteSelect | null>(null);
  const { canEdit } = useStoryRole(note?.storyId);
  const {
    commentsByField,
    canComment,
    isStoryOwner,
    currentUserId,
    addComment,
    deleteComment,
    updateComment,
  } = useEntityComments(note?.storyId, 'Note', noteId);
  const [noteTags, setNoteTags] = useState<TagSelect[]>([]);
  const [allNoteRelations, setAllNoteRelations] = useState<NoteRelation[]>([]);
  const [groupedEntities, setGroupedEntities] = useState<Record<string, RelatedEntityItem[]>>({
    character: [],
    worldrule: [],
    location: [],
    scene: [],
    chapter: [],
    choice: [],
    item: [],
    itemjourney: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  const fetchNote = useCallback(async () => {
    if (!noteServiceRef.current) {
      console.warn('Note service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedNote = await noteServiceRef.current.getById(noteId);
      if (fetchedNote && !fetchedNote.isDeleted) {
        setNote(fetchedNote);
        setHeaderTitle(fetchedNote.title || t('note_details_title'));
      } else if (fetchedNote && fetchedNote.isDeleted) {
        navigation.goBack();
      } else {
        setError(t('note_not_found'));
        setHeaderTitle(t('note_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch note details:', err);
      setError(t('failed_to_load_note'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [noteId, setNote, setLoading, setError, setHeaderTitle, navigation, t]);

  const fetchTagsForNote = useCallback(async () => {
    if (!tagRelationServiceRef.current || !note?.storyId || !noteId) {
      setNoteTags([]);
      return;
    }
    try {
      const fetchedTags = await tagRelationServiceRef.current.getTagsForEntity(
        note.storyId,
        noteId,
        'Note',
      );
      setNoteTags(fetchedTags);
    } catch (err) {
      console.error('Failed to fetch tags for note:', err);
    }
  }, [note?.storyId, noteId]);

  const fetchNoteRelations = useCallback(async () => {
    if (!noteRelationServiceRef.current || !note?.storyId || !noteId) {
      console.warn('NoteRelationService or story not initialized for fetching relations.');
      return;
    }
    try {
      const relations = await noteRelationServiceRef.current.getRelationsForNote(
        note.storyId,
        noteId,
      );
      setAllNoteRelations(relations);
    } catch (err) {
      console.error('Failed to fetch note relations:', err);
    }
  }, [note?.storyId, noteId]);

  const processNoteRelations = useCallback(async () => {
    if (!drizzleDb || !note?.storyId) return;

    const newGroupedEntities: Record<string, RelatedEntityItem[]> = {
      chapter: [],
      character: [],
      choice: [],
      item: [],
      itemjourney: [],
      location: [],
      note: [],
      operationlog: [],
      scene: [],
      story: [],
      suggestion: [],
      tag: [],
      user: [],
      worldrule: [],
      characterrelation: [],
      noterelation: [],
      tagrelation: [],
      characterscene: [],
    };

    for (const relation of allNoteRelations) {
      const entityName = await EntityService.getEntityIdentifier(
        drizzleDb,
        relation.relationType,
        relation.relationId,
        note.storyId,
        t,
      );
      if (entityName) {
        newGroupedEntities[relation.relationType.toLowerCase()].push({
          id: relation.relationId,
          name: entityName,
        });
      }
    }
    setGroupedEntities(newGroupedEntities);
  }, [allNoteRelations, drizzleDb, note?.storyId, t]);

  const handleNoteChange = useCallback(
    async (changedStoryId: string, changedNoteId: string) => {
      if (changedNoteId === noteId) {
        if (noteServiceRef.current) {
          const updatedNote = await noteServiceRef.current.getById(noteId);
          if (!updatedNote || updatedNote.isDeleted) {
            navigation.goBack();
          } else {
            setNote(updatedNote);
            setHeaderTitle(updatedNote.title || t('note_details_title'));
          }
        }
        fetchNoteRelations(); // Refetch relations if the note itself changed
      }
    },
    [noteId, navigation, setNote, setHeaderTitle, t, fetchNoteRelations],
  );

  const handleNoteRelationChange = useCallback(
    (changedStoryId: string, changedRelationId: string) => {
      // This event is emitted when any note_relation changes. We need to check if it affects *this* note.
      // However, for simplicity and ensuring data consistency, we'll refetch all relations for this note.
      // A more optimized approach would involve parsing changedRelationId if it contains noteId.
      fetchNoteRelations();
    },
    [fetchNoteRelations],
  );

  const handleTagRelationChange = useCallback(
    (changedStoryId: string, changedEntityId: string) => {
      if (changedEntityId === noteId) {
        fetchTagsForNote();
      }
    },
    [noteId, fetchTagsForNote],
  );

  const loadInitialNoteData = useCallback(() => {
    if (noteServiceRef.current && selectedStory?.id) {
      void fetchNote();
      void fetchNoteRelations();
    }
  }, [fetchNote, fetchNoteRelations, selectedStory?.id]);

  useEntityInitialLoad(loadInitialNoteData);

  useEntityEventSubscriptions(
    useMemo(
      () => [
        { event: 'note_changed', listener: handleNoteChange },
        { event: 'note_relation_changed', listener: handleNoteRelationChange },
        { event: 'tag_relation_changed', listener: handleTagRelationChange },
      ],
      [handleNoteChange, handleNoteRelationChange, handleTagRelationChange],
    ),
  );

  useEffect(() => {
    if (note) {
      fetchTagsForNote();
      processNoteRelations(); // Process relations after they are fetched
    }
  }, [note, fetchTagsForNote, processNoteRelations]);

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

  if (loading) {
    return <ScreenLoading padded message={t('loading_note_details')} />;
  }

  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }

  if (!note) {
    return (
      <ScreenError padded message={t('note_data_missing')} onGoBack={() => navigation.goBack()} />
    );
  }

  const commentField = createCommentFieldBindings({
    storyId: note.storyId,
    canComment: canComment,
    isStoryOwner: isStoryOwner,
    currentUserId: currentUserId,
    onDeleteComment: deleteComment,
    onUpdateComment: updateComment,
    commentsByField,
    addComment,
  });

  return (
    <DetailContainer
      title={note.title}
      footer={
        <>
          <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
        </>
      }
    >
      <TagList tags={noteTags} variant="chip" emptyMessage={t('no_tags_found')} />

      <CommentableDetailField
        {...commentField('body', note.body || t('common_na'))}
        label={t('body')}
      />

      <CustomAttributeDetailFields storyId={note.storyId} entityType="Note" entityId={noteId} />

      <CommentableDetailField
        {...commentField('extraNotes', note.extraNotes || t('common_na'))}
        label={t('extra_notes')}
      />

      <ScreenSection title={t('media_section_title')} />
      <EntityGalleryManager
        ownerId={noteId}
        ownerType="Note"
        onPressMedia={openGalleryMediaViewer}
        editable={canEdit}
      />

      <RelatedEntitiesList
        title={t('related_entities_title')}
        noItemsMessage={t('no_entities_related')}
        groupedEntities={groupedEntities}
      />

      <FavoritedByList storyId={note.storyId} entityId={noteId} entityType="Note" />

      <EntityMetadata
        version={note.version}
        createdAt={note.createdAt}
        updatedAt={note.updatedAt}
        entityType="Note"
        entityId={note.id}
      />
    </DetailContainer>
  );
};

export default NoteDetailScreen;
