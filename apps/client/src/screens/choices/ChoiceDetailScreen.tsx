import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import EntityMetadata from '@/src/components/common/display/EntityMetadata/EntityMetadata';
import { ScreenError, ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import NoteManager from '@/src/components/features/notes/NoteManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import TagChipList from '@/src/components/common/display/TagChipList/TagChipList';
import { useDrizzle } from '../../db';
import { ChoiceSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityComments } from '../../hooks/useEntityComments';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useStoryRole } from '../../hooks/useStoryRole';
import { createChoiceService } from '../../services/storymanagement/ChoiceService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { setDocumentTitle } from '../../utils/documentTitle';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { ChoicesScreenNavigationProp } from './ChoiceListScreen';

export type ChoiceDetailScreenParamList = {
  ChoiceDetail: { choiceId: string };
};

type ChoiceDetailScreenRouteProp = RouteProp<ChoiceDetailScreenParamList, 'ChoiceDetail'>;

const ChoiceDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<ChoicesScreenNavigationProp>();
  const route = useRoute<ChoiceDetailScreenRouteProp>();
  const { choiceId } = route.params;
  const { t } = useTranslation();
  const { selectedStory } = useStoryStore();
  const scrollBottomPadding = useFormScrollBottomPadding();

  const drizzleDb = useDrizzle();
  const choiceServiceRef = useRef<ReturnType<typeof createChoiceService> | null>(null);

  useEffect(() => {
    if (drizzleDb && !choiceServiceRef.current) {
      choiceServiceRef.current = createChoiceService(drizzleDb);
    }
  }, [drizzleDb]);

  const [choice, setChoice] = useState<ChoiceSelect | null>(null);
  const { canEdit } = useStoryRole(choice?.storyId);
  const {
    commentsByField, canComment, isStoryOwner, currentUserId, addComment, deleteComment, updateComment,
  } = useEntityComments(choice?.storyId, 'Choice', choiceId);

  const {
    selectedTags: choiceTags,
    allNotes,
    noteRelations: choiceNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Choice', entityId: choiceId });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  const commonContainerStyles = getCommonContainerStyles(colors);
  const styles = StyleSheet.create({
    mainTitle: { fontSize: 28, fontWeight: 'bold', color: colors.text, marginBottom: 5 },
    buttonContainer: { marginTop: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginTop: 15, marginBottom: 5 },
  });

  const fetchChoice = useCallback(async () => {
    if (!choiceServiceRef.current) {
      console.warn('Choice service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedChoice = await choiceServiceRef.current.getById(choiceId);
      if (fetchedChoice && !fetchedChoice.isDeleted) {
        setChoice(fetchedChoice);
        setHeaderTitle(fetchedChoice.text || t('choice_details_title')); // Use text
      } else if (fetchedChoice && fetchedChoice.isDeleted) {
        navigation.goBack();
      } else {
        setError(t('choice_not_found'));
        setHeaderTitle(t('choice_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch choice details:', err);
      setError(t('failed_to_load_choice'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [choiceId, navigation, t]);

  const handleChoiceChange = useCallback(async (changedStoryId: string, changedChoiceId: string) => {
    if (changedChoiceId === choiceId && choiceServiceRef.current) {
      const updatedChoice = await choiceServiceRef.current.getById(choiceId);
      if (!updatedChoice || updatedChoice.isDeleted) {
        navigation.goBack();
      } else {
        setChoice(updatedChoice);
        setHeaderTitle(updatedChoice.text || t('choice_details_title')); // Use text
      }
    }
  }, [choiceId, navigation, t]);

  // Notes, note relations and tags are kept fresh by useEntityRelations.
  useEffect(() => {
    fetchChoice();
    entityEventEmitter.on('choice_changed', handleChoiceChange);
    return () => {
      entityEventEmitter.off('choice_changed', handleChoiceChange);
    };
  }, [choiceId, fetchChoice, handleChoiceChange]);


  const renderHeaderRight = useCallback(() => (
    canEdit ? (
      <TouchableOpacity onPress={() => navigation.navigate('ChoiceForm', { choiceId })} style={{ marginRight: 15 }}>
        <Ionicons name="pencil-outline" size={24} color={colors.text} />
      </TouchableOpacity>
    ) : null
  ), [navigation, choiceId, colors.text, canEdit]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: headerTitle, headerRight: renderHeaderRight });
      setDocumentTitle(headerTitle);
    }, [navigation, headerTitle, renderHeaderRight])
  );

  if (loading) {
    return <ScreenLoading padded message={t('loading_choice_details')} />;
  }
  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }
  if (!choice) {
    return <ScreenError padded message={t('choice_data_missing')} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <ScrollView style={commonContainerStyles.container} contentContainerStyle={{ paddingBottom: scrollBottomPadding }}>
      <TagChipList tags={choiceTags} />

      <CommentableDetailField
        storyId={choice.storyId}
        label={t('text')}
        value={choice.text || t('common_na')}
        comments={commentsByField['text'] ?? []}
        canComment={canComment}
        isStoryOwner={isStoryOwner}
        currentUserId={currentUserId}
        onAddComment={(input) => addComment({ fieldKey: 'text' }, { ...input, contentSnapshot: choice.text || t('common_na') })}
        onDeleteComment={deleteComment}
        onUpdateComment={updateComment}
      />

      <NoteManager
        noteRelations={choiceNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={choiceId}
        currentEntityType="Choice"
      />

      <SeeAlsoManager storyId={choice.storyId} entityType="Choice" entityId={choiceId} editable={canEdit} />

      <EntityMetadata version={choice.version} createdAt={choice.createdAt} updatedAt={choice.updatedAt} />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default ChoiceDetailScreen;
