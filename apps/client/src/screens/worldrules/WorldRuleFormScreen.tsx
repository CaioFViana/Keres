import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import Button from '@/src/components/common/controls/Button/Button';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import CustomAttributeFields, {
  getDefaultCustomAttributeValues,
  validateRequiredCustomAttributes,
} from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import SuggestionTextInput from '@/src/components/common/inputs/SuggestionTextInput/SuggestionTextInput';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import NoteManager from '@/src/components/features/notes/NoteManager'; // Import NoteManager
import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import {
  WORLD_PIECE_SECTIONS,
  type WorldPieceSection,
  type WorldRule,
} from '@keres/shared/entities/WorldRule';
import type { RouteProp } from '@react-navigation/native';
import { StackActions, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'; // Import StackActions
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import type { WorldRulesStackParamList } from '../../navigation/MainSystemStack';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import { createWorldRuleService } from '../../services/storymanagement/WorldRuleService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import {
  commonFormStyleDefs,
  getCommonContainerStyles,
  getCommonInputStyles,
} from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { setDocumentTitle } from '../../utils/documentTitle';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';

type WorldRuleFormScreenRouteProp = RouteProp<WorldRulesStackParamList, 'WorldRuleForm'>;

const WorldRuleFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<WorldRuleFormScreenRouteProp>();
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('WorldRule');
  const { userId } = useUserSettingsStore();
  const { worldRuleId: initialWorldRuleId } = route.params || {}; // Renamed to initialWorldRuleId
  const { selectedStory } = useStoryStore();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();
  const confirmDelete = useConfirmDelete();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const worldRuleServiceRef = useRef<ReturnType<typeof createWorldRuleService> | null>(null);
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);

  useEffect(() => {
    if (drizzleDb && !worldRuleServiceRef.current) {
      worldRuleServiceRef.current = createWorldRuleService(drizzleDb);
    }
  }, [drizzleDb]);

  const [currentWorldRuleId, setCurrentWorldRuleId] = useState<string | undefined>(
    initialWorldRuleId,
  ); // State to manage worldRuleId
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState<string | null>(null);
  const [section, setSection] = useState<WorldPieceSection>('rule');
  const [type, setType] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [behavior, setBehavior] = useState<string | null>(null);
  const [usability, setUsability] = useState<string | null>(null);
  const [danger, setDanger] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);

  const {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    allNotes,
    noteRelations: worldRuleNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
    persistNoteRelations,
  } = useEntityRelations({ entityType: 'WorldRule', entityId: currentWorldRuleId });

  const customFields = useStorySchemaFields(selectedStory?.id, 'WorldRule');
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const customDefaultsAppliedRef = useRef(false);

  const [loading, setLoading] = useState(true);

  const isEditing = !!currentWorldRuleId;
  const formTitle = isEditing ? copy.editTitle : copy.createTitle;

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(formTitle);
      navigation.getParent()?.setOptions({
        title: formTitle,
        headerRight: () => <View />,
      });
    }, [navigation, formTitle]),
  );

  useEffect(() => {
    const loadWorldRule = async () => {
      if (!worldRuleServiceRef.current || !selectedStory?.id) {
        console.warn('WorldRule service or selected story not available.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (isEditing) {
          const fetchedWorldRule = await worldRuleServiceRef.current.getById(currentWorldRuleId!);
          if (fetchedWorldRule) {
            setTitle(fetchedWorldRule.title);
            setDescription(fetchedWorldRule.description);
            setSection(fetchedWorldRule.section as WorldPieceSection);
            setType(fetchedWorldRule.type);
            setCategory(fetchedWorldRule.category);
            setBehavior(fetchedWorldRule.behavior);
            setUsability(fetchedWorldRule.usability);
            setDanger(fetchedWorldRule.danger);
            setIsFavorite(fetchedWorldRule.isFavorite);
            setExtraNotes(fetchedWorldRule.extraNotes);

            const existingValues = await createAttributeValueService(drizzleDb).getValuesForEntity(
              currentWorldRuleId!,
            );
            setCustomValues(Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value])));
          } else {
            console.warn('World rule not found:', currentWorldRuleId);
          }
        }
      } catch (err) {
        console.error('Failed to load world rule:', err);
      } finally {
        setLoading(false);
      }
    };
    loadWorldRule();
  }, [currentWorldRuleId, drizzleDb, isEditing, selectedStory?.id, t]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  const handleSave = async () => {
    if (!title.trim()) {
      AppAlert.alert(t('error'), copy.required);
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
      const worldRuleData: Omit<
        WorldRule,
        'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
      > = {
        title: title.trim(),
        description: description,
        section,
        type,
        category,
        behavior,
        usability,
        danger,
        isFavorite: isFavorite,
        extraNotes: extraNotes,
      };
      let savedWorldRule: WorldRule;

      if (isEditing) {
        savedWorldRule = await worldRuleServiceRef.current!.updateWorldRule(
          userId,
          currentWorldRuleId!,
          worldRuleData,
        );
        AppAlert.alert(t('success'), copy.updated);
      } else {
        savedWorldRule = await worldRuleServiceRef.current!.createWorldRule(userId, {
          ...worldRuleData,
          storyId: selectedStory.id,
        });
        AppAlert.alert(t('success'), copy.created);
        setCurrentWorldRuleId(savedWorldRule.id);
      }

      if (savedWorldRule.id) {
        await persistTagRelations(savedWorldRule.id);
        await persistNoteRelations(savedWorldRule.id);
        await seeAlsoManagerRef.current?.persistPending(savedWorldRule.id);
        await createAttributeValueService(drizzleDb).saveValuesForEntity(
          userId,
          selectedStory.id,
          'WorldRule',
          savedWorldRule.id,
          customValues,
        );
      }

      entityEventEmitter.emit('worldrule_changed', selectedStory.id, savedWorldRule.id);

      if (!isEditing && savedWorldRule.id) {
        navigation.dispatch(
          StackActions.replace('WorldRuleForm', { worldRuleId: savedWorldRule.id }),
        );
      } else {
        navigation.goBack();
      }
    } catch (err) {
      console.error('Failed to save world rule:', err);
      AppAlert.alert(t('error'), copy.failedToSave);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!currentWorldRuleId || !worldRuleServiceRef.current) {
      return;
    }

    confirmDelete({
      titleKey: 'delete_world_rule_title',
      title: copy.deleteLabel,
      messageKey: 'delete_world_rule_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_world_rule',
      failureMessage: copy.failedToDelete,
      onLoadingChange: setLoading,
      onConfirm: async () => {
        await worldRuleServiceRef.current!.deleteWorldRule(userId, currentWorldRuleId);
        entityEventEmitter.emit('worldrule_changed', selectedStory?.id, currentWorldRuleId);
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
    ...commonFormStyleDefs(colors, scrollBottomPadding),
    saveButton: {
      marginTop: 30,
      marginBottom: 0,
    },
    deleteButton: {
      backgroundColor: colors.error,
      marginTop: 10,
      marginBottom: 15,
    },
    tagSection: {
      marginTop: 20,
      marginBottom: 0,
    },
    noteSection: {
      // Renamed from tagSection for clarity.
      marginTop: 20,
      marginBottom: -10,
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
      <Text style={[styles.title, { color: colors.text }]}>{formTitle}</Text>
      <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>{copy.formDescription}</Text>

      <Text style={[styles.label, { color: colors.text }]}>{t('title')}</Text>
      <TextInput
        placeholder={t('world_rule_title_placeholder')}
        value={title}
        onChangeText={setTitle}
        style={commonInputStyles.input}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('world_piece_section')}</Text>
      <SingleSelectPill
        options={WORLD_PIECE_SECTIONS.map((value) => ({
          value,
          label: t(`world_piece_section_${value}`),
        }))}
        value={section}
        onValueChange={(next) => {
          const nextSection = (next ?? 'rule') as WorldPieceSection;
          if (nextSection !== section && type) setType(null);
          setSection(nextSection);
        }}
        placeholder={t('world_piece_section')}
        multiple={false}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('world_piece_type')}</Text>
      <SuggestionTextInput
        placeholder={t('world_piece_type_placeholder')}
        value={type || ''}
        onChangeText={setType}
        type={`world_piece_type:${section}`}
        storyId={selectedStory?.id || ''}
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

      <Text style={[styles.label, { color: colors.text }]}>{t('description')}</Text>
      <TextInput
        placeholder={t('world_rule_description_placeholder')}
        value={description || ''}
        onChangeText={setDescription}
        style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
        multiline
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('category')}</Text>
      <SuggestionTextInput
        placeholder={t('category_placeholder')}
        value={category || ''}
        onChangeText={setCategory}
        type="world_piece_category"
        storyId={selectedStory?.id || ''}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('world_piece_behavior')}</Text>
      <TextInput
        placeholder={t('world_piece_behavior_placeholder')}
        value={behavior || ''}
        onChangeText={setBehavior}
        style={commonInputStyles.input}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('world_piece_usability')}</Text>
      <TextInput
        placeholder={t('world_piece_usability_placeholder')}
        value={usability || ''}
        onChangeText={setUsability}
        style={commonInputStyles.input}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('world_piece_danger')}</Text>
      <TextInput
        placeholder={t('world_piece_danger_placeholder')}
        value={danger || ''}
        onChangeText={setDanger}
        style={commonInputStyles.input}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('extra_notes')}</Text>
      <TextInput
        placeholder={t('world_rule_extra_notes_placeholder')}
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

      <View style={styles.tagSection}>
        <MultiSelectPill
          options={availableTags.map((tag) => ({
            label: tag.name,
            value: tag.id,
            color: tag.color || colors.primaryContainer,
          }))}
          selectedValues={selectedTagIds}
          onSelectionChange={handleTagSelectionChange}
          placeholder={t('select_tags_for_world_rule')}
          label={t('world_rule_tags')}
        />
      </View>

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <NoteManager
            noteRelations={worldRuleNoteRelations}
            availableNotes={allNotes}
            onSave={saveNoteRelation}
            onDelete={deleteNoteRelation}
            editable={true}
            currentStoryId={selectedStory.id}
            currentEntityId={currentWorldRuleId ?? ''}
            currentEntityType="WorldRule"
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <SeeAlsoManager
            ref={seeAlsoManagerRef}
            storyId={selectedStory.id}
            entityType="WorldRule"
            entityId={currentWorldRuleId ?? ''}
            editable={true}
          />
        </View>
      )}

      <FormActions stackOnCompact style={styles.saveButton}>
        <Button onPress={handleSave}>{copy.saveLabel}</Button>
        {isEditing && (
          <Button onPress={handleDelete} style={{ backgroundColor: colors.error }}>
            {copy.deleteLabel}
          </Button>
        )}
      </FormActions>
    </KeyboardAwareScreen>
  );
};

export default WorldRuleFormScreen;
