import Button from '@/src/components/common/controls/Button/Button';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import CustomAttributeFields, {
  CustomAttributeValues,
  getDefaultCustomAttributeValues,
  validateRequiredCustomAttributes,
} from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import NoteManager from '@/src/components/features/notes/NoteManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { Chapter } from '@keres/shared/entities/Chapter';
import {
  RouteProp,
  StackActions,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../db';
import { ChapterSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import { ChapterStackParamList } from '../../navigation/MainSystemStack';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import { createChapterService } from '../../services/storymanagement/ChapterService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { setDocumentTitle } from '../../utils/documentTitle';
import { entityEventEmitter } from '../../utils/EventEmitter';

type ChapterFormScreenRouteProp = RouteProp<ChapterStackParamList, 'ChapterForm'>;
type ChapterFormScreenNavigationProp = NativeStackNavigationProp<
  ChapterStackParamList,
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
  const { selectedStory } = useStoryStore();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();

  const confirmDelete = useConfirmDelete();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const chapterServiceRef = useRef<ReturnType<typeof createChapterService> | null>(null);

  useEffect(() => {
    if (drizzleDb && !chapterServiceRef.current) {
      chapterServiceRef.current = createChapterService(drizzleDb);
    }
  }, [drizzleDb]);

  const [currentChapterId, setCurrentChapterId] = useState<string | undefined>(initialChapterId);
  const [name, setName] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);

  const {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    allNotes,
    noteRelations: chapterNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Chapter', entityId: currentChapterId });

  const customFields = useStorySchemaFields(selectedStory?.id, 'Chapter');
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const customDefaultsAppliedRef = useRef(false);

  const [loading, setLoading] = useState(true);

  const isEditing = !!currentChapterId;

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(isEditing ? t('edit_chapter_title') : t('create_chapter_title'));
      navigation.getParent()?.setOptions({
        title: isEditing ? t('edit_chapter_title') : t('create_chapter_title'),
        headerRight: () => <View />,
      });
    }, [navigation, isEditing, t]),
  );

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
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  const handleSave = async () => {
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

    setLoading(true);

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
      };

      let savedChapter: ChapterSelect;

      if (isEditing) {
        savedChapter = await chapterServiceRef.current!.updateChapter(
          userId,
          currentChapterId!,
          chapterData,
        );
        AppAlert.alert(t('success'), t('chapter_updated_successfully'));
      } else {
        // For new chapters, determine the next index
        const allChapters = await chapterServiceRef.current!.getAllByStoryId(selectedStory.id);
        const nextIndex =
          allChapters.length > 0 ? Math.max(...allChapters.map((c) => c.index || 0)) + 1 : 1;
        savedChapter = await chapterServiceRef.current!.createChapter(userId, {
          ...chapterData,
          storyId: selectedStory.id,
          index: nextIndex,
        });
        AppAlert.alert(t('success'), t('chapter_created_successfully'));
        setCurrentChapterId(savedChapter.id);
      }

      if (savedChapter.id) {
        await persistTagRelations(savedChapter.id);
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
      AppAlert.alert(t('error'), t('failed_to_save_chapter'));
    } finally {
      setLoading(false);
    }
  };

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
      messageKey: 'delete_chapter_message',
      successKey: 'chapter_deleted_successfully',
      failureKey: 'failed_to_delete_chapter',
      onLoadingChange: setLoading,
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
    scrollViewContent: {
      padding: 20,
      paddingBottom: scrollBottomPadding,
      flexGrow: 1,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 5,
    },
    label: {
      fontSize: 16,
      fontWeight: 'bold',
      marginTop: 15,
      marginBottom: 5,
    },
    switchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 15,
      marginBottom: 5,
    },
    saveButton: {
      marginTop: 10,
      marginBottom: 0,
    },
    deleteButton: {
      backgroundColor: 'red',
      marginBottom: 15,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    noteSection: {
      // Renamed from tagSection for clarity.
      marginTop: 20,
      marginBottom: -10,
    },
    tagSection: {
      marginTop: 20,
      marginBottom: 0,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 10,
    },
  });

  if (loading) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={{ color: colors.text }}>{t('loading')}...</Text>
      </View>
    );
  }

  return (
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={styles.scrollViewContent}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        {isEditing ? t('edit_chapter_title') : t('create_chapter_title')}
      </Text>
      <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
        {t('chapter_form_description')}
      </Text>

      <Text style={[styles.label, { color: colors.text }]}>{t('name')}</Text>
      <TextInput
        placeholder={t('name_placeholder')}
        value={name}
        onChangeText={setName}
        style={commonInputStyles.input}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('summary')}</Text>
      <TextInput
        placeholder={t('summary_placeholder')}
        value={summary || ''}
        onChangeText={setSummary}
        style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
        multiline
      />

      <View style={styles.switchContainer}>
        <Text style={[styles.label, { color: colors.text, flex: 1, lineHeight: 30, marginTop: 5 }]}>
          {t('is_favorite')}
        </Text>
        <ThemedSwitch
          value={isFavorite}
          onValueChange={setIsFavorite}
          style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
        />
      </View>

      <Text style={[styles.label, { color: colors.text }]}>{t('extra_notes')}</Text>
      <TextInput
        placeholder={t('extra_notes_placeholder')}
        value={extraNotes || ''}
        onChangeText={setExtraNotes}
        style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
        multiline
      />

      <CustomAttributeFields
        storyId={selectedStory?.id || ''}
        fields={customFields}
        values={customValues}
        onChange={(fieldId, value) => setCustomValues((prev) => ({ ...prev, [fieldId]: value }))}
      />

      {currentChapterId && selectedStory?.id && (
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
          <NoteManager
            noteRelations={chapterNoteRelations}
            availableNotes={allNotes}
            onSave={saveNoteRelation}
            onDelete={deleteNoteRelation}
            editable={true}
            currentStoryId={selectedStory.id}
            currentEntityId={currentChapterId}
            currentEntityType="Chapter"
          />
        </View>
      )}

      {currentChapterId && selectedStory?.id && (
        <View style={styles.tagSection}>
          <SeeAlsoManager
            storyId={selectedStory.id}
            entityType="Chapter"
            entityId={currentChapterId}
            editable={true}
          />
        </View>
      )}

      <Button onPress={handleSave} style={styles.saveButton}>
        {t('save_chapter')}
      </Button>

      {isEditing && (
        <Button onPress={handleDelete} style={[styles.saveButton, styles.deleteButton]}>
          {t('delete_chapter_title')}
        </Button>
      )}
    </KeyboardAwareScreen>
  );
};

export default ChapterFormScreen;
