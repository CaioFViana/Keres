import MultiSelectPill from '@/src/components/common/MultiSelectPill/MultiSelectPill';
import Select from '@/src/components/common/Select/Select';
import TextInput from '@/src/components/common/TextInput/TextInput';
import { Choice } from '@keres/shared/entities/Choice';
import { RouteProp, StackActions, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '../../components/common/Button/Button';
import KeyboardAwareScreen from '../../components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import NoteManager from '../../components/NoteManager';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { ChoiceStackParamList } from '../../navigation/MainSystemStack';
import { createChoiceService } from '../../services/storymanagement/ChoiceService';
import { useSceneStore } from '../../state/sceneStore';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { AppAlert } from '../../utils/AppAlert';

type ChoiceFormScreenRouteProp = RouteProp<ChoiceStackParamList, 'ChoiceForm'>;
type ChoiceFormScreenNavigationProp = NativeStackNavigationProp<ChoiceStackParamList, 'ChoiceForm'>;

const ChoiceFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<ChoiceFormScreenNavigationProp>();
  const route = useRoute<ChoiceFormScreenRouteProp>();
  const { choiceId: initialChoiceId } = route.params || {};
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
  const { scenes, fetchScenes, setDbAndStoryId: setSceneDbAndStoryId, initializeService: initializeSceneService } = useSceneStore();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();

  const confirmDelete = useConfirmDelete();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const choiceServiceRef = useRef<ReturnType<typeof createChoiceService> | null>(null);

  useEffect(() => {
    if (drizzleDb && !choiceServiceRef.current) {
      choiceServiceRef.current = createChoiceService(drizzleDb);
    }
  }, [drizzleDb]);

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setSceneDbAndStoryId(drizzleDb, selectedStory.id);
      initializeSceneService();
      fetchScenes();
    }
  }, [drizzleDb, selectedStory?.id, setSceneDbAndStoryId, initializeSceneService, fetchScenes]);

  const [currentChoiceId, setCurrentChoiceId] = useState<string | undefined>(initialChoiceId);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [nextSceneId, setNextSceneId] = useState<string | null>(null);
  const [text, setText] = useState(''); // Changed from description

  const {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    allNotes,
    noteRelations: choiceNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Choice', entityId: currentChoiceId });

  const [loading, setLoading] = useState(true);

  const isEditing = !!currentChoiceId;

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(isEditing ? t('edit_choice_title') : t('create_choice_title'));
      navigation.getParent()?.setOptions({
        title: isEditing ? t('edit_choice_title') : t('create_choice_title'),
        headerRight: () => <View />,
      });
    }, [navigation, isEditing, t])
  );

  useEffect(() => {
    const loadChoice = async () => {
      if (!choiceServiceRef.current || !selectedStory?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        if (isEditing) {
          const fetchedChoice = await choiceServiceRef.current.getById(currentChoiceId!);
          if (fetchedChoice) {
            setSceneId(fetchedChoice.sceneId);
            setNextSceneId(fetchedChoice.nextSceneId);
            setText(fetchedChoice.text); // Use text
          } else {
            console.warn('Choice not found:', currentChoiceId);
          }
        }
      } catch (err) {
        console.error('Failed to load choice:', err);
      } finally {
        setLoading(false);
      }
    };
    loadChoice();
  }, [currentChoiceId, isEditing, selectedStory?.id, t]);

  const handleSave = async () => {
    if (!text.trim()) {
      AppAlert.alert(t('error'), t('text_required')); // Use text_required
      return;
    }
    if (!sceneId) {
      AppAlert.alert(t('error'), t('scene_required'));
      return;
    }
    if (!nextSceneId) {
      AppAlert.alert(t('error'), t('next_scene_required'));
      return;
    }
    if (!userId || !selectedStory?.id) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }

    setLoading(true);

    try {
      const choiceData: Omit<Choice, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'> = {
        sceneId: sceneId,
        nextSceneId: nextSceneId,
        text: text.trim(), // Use text
      };

      let savedChoiceId: string | undefined = currentChoiceId;

      if (isEditing && currentChoiceId) {
        const savedChoice = await choiceServiceRef.current!.updateChoice(userId, currentChoiceId, choiceData);
        savedChoiceId = savedChoice.id;
        AppAlert.alert(t('success'), t('choice_updated_successfully'));
      } else {
        const savedChoice = await choiceServiceRef.current!.createChoice(userId, { ...choiceData, storyId: selectedStory.id });
        savedChoiceId = savedChoice.id;
        setCurrentChoiceId(savedChoice.id);
        AppAlert.alert(t('success'), t('choice_created_successfully'));
      }

      if (savedChoiceId) {
        await persistTagRelations(savedChoiceId);
      }
      entityEventEmitter.emit('choice_changed', selectedStory.id, savedChoiceId);

      if (!isEditing && savedChoiceId) {
        navigation.dispatch(StackActions.replace('ChoiceForm', { choiceId: savedChoiceId }));
      } else {
        navigation.goBack();
      }
    } catch (err) {
      console.error('Failed to save choice:', err);
      AppAlert.alert(t('error'), t('failed_to_save_choice'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!currentChoiceId || !choiceServiceRef.current) {
      return;
    }

    confirmDelete({
      titleKey: 'delete_choice_title',
      messageKey: 'delete_choice_message',
      successKey: 'choice_deleted_successfully',
      failureKey: 'failed_to_delete_choice',
      onLoadingChange: setLoading,
      onConfirm: async () => {
        await choiceServiceRef.current!.deleteChoice(userId, currentChoiceId);
        entityEventEmitter.emit('choice_changed', selectedStory?.id, currentChoiceId);
        navigation.goBack();
      },
    });
  };

  const sceneOptions = useMemo(() => scenes.map(scene => ({ label: scene.name, value: scene.id })), [scenes]);

  const styles = StyleSheet.create({
    scrollViewContent: { padding: 20, paddingBottom: scrollBottomPadding, flexGrow: 1 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
    label: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
    saveButton: { marginTop: 20, marginBottom: 0 },
    deleteButton: { backgroundColor: 'red', marginBottom: 15 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    noteSection: { marginTop: 20, marginBottom: 10 },
    tagSection: { marginTop: 20, marginBottom: 10 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 10 },
  });

  if (loading) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={{ color: colors.text }}>{t('loading')}...</Text>
      </View>
    );
  }

  return (
      <KeyboardAwareScreen style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
          <Text style={[styles.title, { color: colors.text }]}>{isEditing ? t('edit_choice_title') : t('create_choice_title')}</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>{t('choice_form_description')}</Text>

          <Text style={[styles.label, { color: colors.text }]}>{t('text')}</Text>
          <TextInput
            placeholder={t('text_placeholder')}
            value={text}
            onChangeText={setText}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('parent_scene')}</Text>
          <Select options={sceneOptions} value={sceneId} onValueChange={setSceneId} placeholder={t('select_parent_scene')} multiple={false} />

          <Text style={[styles.label, { color: colors.text }]}>{t('next_scene')}</Text>
          <Select options={sceneOptions} value={nextSceneId} onValueChange={setNextSceneId} placeholder={t('select_next_scene')} multiple={false} />

          {currentChoiceId && selectedStory?.id && (
            <View style={styles.tagSection}>
              <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
              <MultiSelectPill
                options={availableTags.map(tag => ({ label: tag.name, value: tag.id, color: tag.color || colors.primaryContainer }))}
                selectedValues={selectedTagIds}
                onSelectionChange={setSelectedTagIds}
                placeholder={t('select_tags_for_choice')}
                label={t('choice_tags')}
              />
            </View>
          )}

          {currentChoiceId && selectedStory?.id && (
            <View style={styles.noteSection}>
              <Text style={styles.sectionTitle}>{t('notes_title')}</Text>
              <NoteManager
                noteRelations={choiceNoteRelations}
                availableNotes={allNotes}
                onSave={saveNoteRelation}
                onDelete={deleteNoteRelation}
                editable={true}
                currentStoryId={selectedStory.id}
                currentEntityId={currentChoiceId}
                currentEntityType="Choice"
              />
            </View>
          )}

          <Button onPress={handleSave} style={styles.saveButton}>{t('save_choice')}</Button>
          {isEditing && (<Button onPress={handleDelete} style={[styles.saveButton, styles.deleteButton]}>{t('delete_choice_title')}</Button>)}
      </KeyboardAwareScreen>
  );
};

export default ChoiceFormScreen;
