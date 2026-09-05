import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import CustomAttributeFields, {
  getDefaultCustomAttributeValues,
  validateRequiredCustomAttributes,
} from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import MultiSelectPill, {
  SingleSelectPill,
} from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import AnchorManager from '@/src/components/features/chapters/AnchorManager/AnchorManager';
import NoteManager from '@/src/components/features/notes/NoteManager';
import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import type { Chapter } from '@keres/shared/entities/Chapter';
import type { RouteProp } from '@react-navigation/native';
import { StackActions, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../../db';
import type { ChapterSelect, StoryArcSelect } from '../../../db/schema';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../../hooks/useConfirmDelete';
import { useEntityRelations } from '../../../hooks/useEntityRelations';
import { useStorySchemaFields } from '../../../hooks/useStorySchemaFields';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import { createAttributeValueService } from '../../../services/storymanagement/AttributeValueService';
import { createChapterService } from '../../../services/storymanagement/ChapterService';
import { createStoryArcService } from '../../../services/storymanagement/StoryArcService';
import { useStoryVocabulary } from '../../../vocabulary/useStoryVocabulary';
import { useStoryStore } from '../../../state/storyStore';
import { useUserSettingsStore } from '../../../state/userSettingsStore';
import { useTheme } from '../../../theme';
import { getCommonInputStyles } from '../../../theme/commonStyles';
import { AppAlert } from '../../../utils/AppAlert';
import { entityEventEmitter } from '../../../utils/EventEmitter';
import { useVocabularyEntityCopy } from '../../../vocabulary/useVocabularyEntityCopy';

type ChapterFormScreenRouteProp = RouteProp<NarrativeElementsStackParamList, 'ChapterForm'>;
type ChapterFormScreenNavigationProp = NativeStackNavigationProp<
  NarrativeElementsStackParamList,
  'ChapterForm'
>;

const ChapterFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<ChapterFormScreenNavigationProp>();
  const route = useRoute<ChapterFormScreenRouteProp>();
  const { chapterId: initialChapterId } = route.params || {};
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { selectedStory, activeArcId } = useStoryStore();
  const vocab = useStoryVocabulary();

  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();

  const confirmDelete = useConfirmDelete();

  const chapterServiceRef = useRef<ReturnType<typeof createChapterService> | null>(null);
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);

  useEffect(() => {
    if (drizzleDb && !chapterServiceRef.current) {
      chapterServiceRef.current = createChapterService(drizzleDb);
    }
  }, [drizzleDb]);

  const [currentChapterId, setCurrentChapterId] = useState<string | undefined>(initialChapterId);
  const [name, setName] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  /** Only chosen at creation; changing it afterwards is a conversion - see `ChapterDetailScreen`. */
  const [isEvent, setIsEvent] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [arcId, setArcId] = useState<string | null>(activeArcId);
  const [arcs, setArcs] = useState<StoryArcSelect[]>([]);

  const {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    allNotes,
    noteRelations: chapterNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
    persistNoteRelations,
  } = useEntityRelations({ entityType: 'Chapter', entityId: currentChapterId });

  const customFields = useStorySchemaFields(selectedStory?.id, 'Chapter');
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const customDefaultsAppliedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!currentChapterId;
  const copy = useVocabularyEntityCopy(isEvent ? 'Event' : 'Chapter');
  const arcCopy = useVocabularyEntityCopy('Arc');
  const formTitle = isEditing ? copy.editTitle : copy.createTitle;

  useScreenHeader({
    target: 'parent',
    title: formTitle,
  });

  useEffect(() => {
    const loadChapter = async () => {
      if (!chapterServiceRef.current || !selectedStory?.id) {
        console.warn('Chapter service or selected story not available.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (isEditing) {
          const fetchedChapter = await chapterServiceRef.current.getById(currentChapterId!);
          if (fetchedChapter) {
            setName(fetchedChapter.name);
            setSummary(fetchedChapter.summary);
            setIsFavorite(fetchedChapter.isFavorite);
            setExtraNotes(fetchedChapter.extraNotes);
            setIsEvent(fetchedChapter.type === 'event');
            setArcId(fetchedChapter.arcId ?? null);

            const existingValues = await createAttributeValueService(drizzleDb).getValuesForEntity(
              currentChapterId!,
            );
            setCustomValues(Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value])));
          } else {
            console.warn('Chapter not found:', currentChapterId);
          }
        }
      } catch (err) {
        console.error('Failed to load chapter:', err);
      } finally {
        setLoading(false);
      }
    };
    loadChapter();
  }, [currentChapterId, drizzleDb, isEditing, selectedStory?.id, t]);

  useEffect(() => {
    if (!selectedStory?.id) return;
    void createStoryArcService(drizzleDb)
      .getArcsForStory(selectedStory.id)
      .then((loaded) => {
        setArcs(loaded);
        if (!isEditing) {
          setArcId(
            (current) =>
              current ?? loaded.find((arc) => arc.isDefault)?.id ?? loaded[0]?.id ?? null,
          );
        }
      });
  }, [drizzleDb, isEditing, selectedStory?.id]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  const handleSave = () =>
    runSave(async () => {
      if (!name.trim()) {
        AppAlert.alert(t('error'), t('name_required'));
        return;
      }
      const missingRequiredField = validateRequiredCustomAttributes(customFields, customValues);
      if (missingRequiredField) {
        AppAlert.alert(t('error'), t('custom_attribute_required', { field: missingRequiredField }));
        return;
      }
      if (!userId) {
        AppAlert.alert(t('error'), t('user_not_identified'));
        return;
      }
      if (!selectedStory?.id) {
        AppAlert.alert(t('error'), t('no_story_selected'));
        return;
      }

      try {
        let chapterData: Omit<
          Chapter,
          | 'id'
          | 'storyId'
          | 'createdAt'
          | 'updatedAt'
          | 'version'
          | 'isDeleted'
          | 'deletedAt'
          | 'index'
        > = {
          name: name.trim(),
          summary,
          isFavorite,
          extraNotes,
          arcId,
        };

        let savedChapter: ChapterSelect;

        if (isEditing) {
          savedChapter = await chapterServiceRef.current!.updateChapter(
            userId,
            currentChapterId!,
            chapterData,
          );
          AppAlert.alert(t('success'), copy.updated);
        } else {
          // The next index within its own kind: chapters and events number independently, so the two
          // spaces would collide if this counted across both.
          const containerType = isEvent ? 'event' : 'chapter';
          const siblings = await chapterServiceRef.current!.getAllByStoryId(
            selectedStory.id,
            containerType,
          );
          const nextIndex =
            siblings.length > 0 ? Math.max(...siblings.map((c) => c.index || 0)) + 1 : 1;
          savedChapter = await chapterServiceRef.current!.createChapter(userId, {
            ...chapterData,
            storyId: selectedStory.id,
            index: nextIndex,
            type: containerType,
          });
          AppAlert.alert(t('success'), copy.created);
          setCurrentChapterId(savedChapter.id);
        }

        if (savedChapter.id) {
          await persistTagRelations(savedChapter.id);
          await persistNoteRelations(savedChapter.id);
          await seeAlsoManagerRef.current?.persistPending(savedChapter.id);
          await createAttributeValueService(drizzleDb).saveValuesForEntity(
            userId,
            selectedStory.id,
            'Chapter',
            savedChapter.id,
            customValues,
          );
        }

        entityEventEmitter.emit('chapter_changed', selectedStory.id, savedChapter.id);

        if (!isEditing && savedChapter.id) {
          navigation.dispatch(StackActions.replace('ChapterForm', { chapterId: savedChapter.id }));
        } else {
          navigation.goBack();
        }
      } catch (err) {
        console.error('Failed to save chapter:', err);
        AppAlert.alert(t('error'), copy.failedToSave);
      }
    });

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }

    if (!currentChapterId || !chapterServiceRef.current) {
      return;
    }

    confirmDelete({
      titleKey: 'delete_chapter_title',
      title: copy.deleteLabel,
      messageKey: 'delete_chapter_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_chapter',
      failureMessage: copy.failedToDelete,
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await chapterServiceRef.current!.deleteChapter(userId, currentChapterId);
        entityEventEmitter.emit('chapter_changed', selectedStory?.id, currentChapterId);
        navigation.goBack();
      },
    });
  };

  const handleTagSelectionChange = useCallback(
    (newSelection: string[]) => {
      setSelectedTagIds(newSelection);
    },
    [setSelectedTagIds],
  );

  const styles = StyleSheet.create({
    noteSection: {
      // Renamed from tagSection for clarity.
      marginTop: 20,
      marginBottom: -10,
    },
    tagSection: {
      marginTop: 20,
      marginBottom: 0,
    },
  });

  if (loading) {
    return <ScreenLoading />;
  }

  return (
    <EntityFormContainer
      title={formTitle}
      description={copy.formDescription}
      actions={
        <>
          <Button onPress={handleSave} disabled={saving || deleting}>
            {copy.saveLabel}
          </Button>
          {isEditing && (
            <Button
              onPress={handleDelete}
              style={{ backgroundColor: colors.error }}
              disabled={saving || deleting}
            >
              {copy.deleteLabel}
            </Button>
          )}
        </>
      }
    >
      <FormField label={t('name')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('name_placeholder')}
            value={name}
            onChangeText={setName}
            style={commonInputStyles.input}
          />
        )}
      </FormField>

      {arcs.length > 1 ? (
        <>
          <FormField label={vocab.term('Arc')}>
            <SingleSelectPill
              options={arcs.map((arc) => ({
                label: arc.title,
                value: arc.id,
                color: arc.color,
              }))}
              value={arcId}
              onValueChange={setArcId}
              placeholder={arcCopy.select}
              allowDeselect={false}
            />
          </FormField>
        </>
      ) : null}

      <FormField label={t('summary')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('summary_placeholder')}
            value={summary || ''}
            onChangeText={setSummary}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

      <FormSwitchField label={t('is_favorite')} value={isFavorite} onValueChange={setIsFavorite} />

      {/*
        Only while creating. Changing the kind afterwards moves the container between two index
        spaces and rewrites both, which is three operations rather than a saved field - it lives on
        the detail screen as a deliberate action. See `ConvertContainerModal`.
      */}
      {!isEditing && (
        <>
          <FormSwitchField
            label={t('chapter_is_event')}
            value={isEvent}
            onValueChange={setIsEvent}
            testID="chapter-is-event"
          />
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 5 }}>
            {t('chapter_is_event_hint')}
          </Text>
        </>
      )}

      <FormField label={t('extra_notes')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('extra_notes_placeholder')}
            value={extraNotes || ''}
            onChangeText={setExtraNotes}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

      <CustomAttributeFields
        storyId={selectedStory?.id || ''}
        fields={customFields}
        values={customValues}
        onChange={(fieldId, value) => setCustomValues((prev) => ({ ...prev, [fieldId]: value }))}
      />

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <MultiSelectPill
            options={availableTags.map((tag) => ({
              label: tag.name,
              value: tag.id,
              color: tag.color || colors.primaryContainer,
            }))}
            selectedValues={selectedTagIds}
            onSelectionChange={handleTagSelectionChange}
            placeholder={t('select_tags_for_chapter')}
            label={t('chapter_tags')}
          />
        </View>
      )}

      {currentChapterId && selectedStory?.id && (
        <View style={styles.noteSection}>
          <AnchorManager
            storyId={selectedStory.id}
            chapterId={currentChapterId}
            currentUserId={userId}
            editable={true}
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <NoteManager
            noteRelations={chapterNoteRelations}
            availableNotes={allNotes}
            onSave={saveNoteRelation}
            onDelete={deleteNoteRelation}
            editable={true}
            currentStoryId={selectedStory.id}
            currentEntityId={currentChapterId ?? ''}
            currentEntityType="Chapter"
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <SeeAlsoManager
            ref={seeAlsoManagerRef}
            storyId={selectedStory.id}
            entityType="Chapter"
            entityId={currentChapterId ?? ''}
            editable={true}
          />
        </View>
      )}
    </EntityFormContainer>
  );
};

export default ChapterFormScreen;
