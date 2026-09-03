import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import Button from '@/src/components/common/controls/Button/Button';
import MultiSelectPill, {
  SingleSelectPill,
} from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import NoteManager from '@/src/components/features/notes/NoteManager';
import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import type { Choice } from '@keres/shared/entities/Choice';
import type { ChoiceCheck } from '@keres/shared/entities/ChoiceCheck';
import type { ChoiceCheckGroup } from '@keres/shared/entities/ChoiceCheckGroup';
import type { Effect } from '@keres/shared/entities/Effect';
import type { RouteProp } from '@react-navigation/native';
import { StackActions, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../../db';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../../hooks/useConfirmDelete';
import { useEntityRelations } from '../../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../../hooks/useFormScrollBottomPadding';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import { createChoiceCheckGroupService } from '../../../services/storymanagement/ChoiceCheckGroupService';
import { createChoiceCheckService } from '../../../services/storymanagement/ChoiceCheckService';
import { createChoiceService } from '../../../services/storymanagement/ChoiceService';
import { createEffectService } from '../../../services/storymanagement/EffectService';
import { useItemStore } from '../../../state/itemStore';
import { useSceneStore } from '../../../state/sceneStore';
import { useStoryStore } from '../../../state/storyStore';
import { useUserSettingsStore } from '../../../state/userSettingsStore';
import { useTheme } from '../../../theme';
import { useVocabularyEntityCopy } from '../../../vocabulary/useVocabularyEntityCopy';
import {
  commonFormStyleDefs,
  getCommonContainerStyles,
  getCommonInputStyles,
} from '../../../theme/commonStyles';
import { AppAlert } from '../../../utils/AppAlert';
import { setDocumentTitle } from '../../../utils/documentTitle';
import { entityEventEmitter } from '../../../utils/EventEmitter';

type ChoiceFormScreenRouteProp = RouteProp<NarrativeElementsStackParamList, 'ChoiceForm'>;
type ChoiceFormScreenNavigationProp = NativeStackNavigationProp<
  NarrativeElementsStackParamList,
  'ChoiceForm'
>;

const ChoiceFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<ChoiceFormScreenNavigationProp>();
  const route = useRoute<ChoiceFormScreenRouteProp>();
  const { choiceId: initialChoiceId, sceneId: initialSceneId } = route.params || {};
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Choice');
  const sceneCopy = useVocabularyEntityCopy('Scene');
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
  const {
    scenes,
    fetchScenes,
    setDbAndStoryId: setSceneDbAndStoryId,
    initializeService: initializeSceneService,
  } = useSceneStore();
  const {
    items,
    fetchItems,
    setDbAndStoryId: setItemDbAndStoryId,
    initializeService: initializeItemService,
  } = useItemStore();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();

  const confirmDelete = useConfirmDelete();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const choiceServiceRef = useRef<ReturnType<typeof createChoiceService> | null>(null);
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);
  const choiceCheckGroupServiceRef = useRef<ReturnType<
    typeof createChoiceCheckGroupService
  > | null>(null);
  const choiceCheckServiceRef = useRef<ReturnType<typeof createChoiceCheckService> | null>(null);
  const effectServiceRef = useRef<ReturnType<typeof createEffectService> | null>(null);

  const isBranching = selectedStory?.type === 'branching';

  useEffect(() => {
    if (drizzleDb) {
      if (!choiceServiceRef.current) {
        choiceServiceRef.current = createChoiceService(drizzleDb);
      }
      if (!choiceCheckGroupServiceRef.current) {
        choiceCheckGroupServiceRef.current = createChoiceCheckGroupService(drizzleDb);
      }
      if (!choiceCheckServiceRef.current) {
        choiceCheckServiceRef.current = createChoiceCheckService(drizzleDb);
      }
      if (!effectServiceRef.current) {
        effectServiceRef.current = createEffectService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setSceneDbAndStoryId(drizzleDb, selectedStory.id);
      initializeSceneService();
      fetchScenes();

      setItemDbAndStoryId(drizzleDb, selectedStory.id);
      initializeItemService();
      fetchItems();
    }
  }, [
    drizzleDb,
    selectedStory?.id,
    setSceneDbAndStoryId,
    initializeSceneService,
    fetchScenes,
    setItemDbAndStoryId,
    initializeItemService,
    fetchItems,
  ]);

  const [currentChoiceId, setCurrentChoiceId] = useState<string | undefined>(initialChoiceId);
  const [sceneId, setSceneId] = useState<string | null>(initialSceneId ?? null);
  const [nextSceneId, setNextSceneId] = useState<string | null>(null);
  const [text, setText] = useState(''); // Changed from description
  const [notes, setNotes] = useState<string | null>(null);
  const [checkGroups, setCheckGroups] = useState<ChoiceCheckGroup[]>([]);
  const [checks, setChecks] = useState<ChoiceCheck[]>([]);
  const [choiceEffects, setChoiceEffects] = useState<Effect[]>([]);

  const {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    allNotes,
    noteRelations: choiceNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
    persistNoteRelations,
  } = useEntityRelations({ entityType: 'Choice', entityId: currentChoiceId });

  const [loading, setLoading] = useState(true);

  const isEditing = !!currentChoiceId;
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
            setNotes(fetchedChoice.notes);
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

  const fetchChecksAndEffects = useCallback(async () => {
    if (
      !choiceCheckGroupServiceRef.current ||
      !choiceCheckServiceRef.current ||
      !effectServiceRef.current ||
      !selectedStory?.id ||
      !currentChoiceId
    ) {
      setCheckGroups([]);
      setChecks([]);
      setChoiceEffects([]);
      return;
    }
    try {
      const groups = await choiceCheckGroupServiceRef.current.getChoiceCheckGroupsByChoiceId(
        selectedStory.id,
        currentChoiceId,
      );
      setCheckGroups(groups);
      const checksByGroupArrays = await Promise.all(
        groups.map((group) =>
          choiceCheckServiceRef.current!.getChoiceChecksByGroupId(selectedStory.id, group.id),
        ),
      );
      setChecks(checksByGroupArrays.flat());
      const fetchedEffects = await effectServiceRef.current.getEffectsByEntity(
        selectedStory.id,
        'Choice',
        currentChoiceId,
      );
      setChoiceEffects(fetchedEffects);
    } catch (err) {
      console.error('Failed to load choice checks/effects:', err);
    }
  }, [selectedStory?.id, currentChoiceId]);

  useEffect(() => {
    if (isBranching) {
      fetchChecksAndEffects();
    }
  }, [isBranching, fetchChecksAndEffects]);

  const handleSave = async () => {
    if (!text.trim()) {
      AppAlert.alert(t('error'), t('text_required')); // Use text_required
      return;
    }
    if (!sceneId) {
      AppAlert.alert(t('error'), sceneCopy.required);
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
      const choiceData: Omit<
        Choice,
        'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
      > = {
        sceneId: sceneId,
        nextSceneId: nextSceneId,
        text: text.trim(), // Use text
        notes: notes && notes.trim() ? notes.trim() : null,
      };

      let savedChoiceId: string | undefined = currentChoiceId;

      if (isEditing && currentChoiceId) {
        const savedChoice = await choiceServiceRef.current!.updateChoice(
          userId,
          currentChoiceId,
          choiceData,
        );
        savedChoiceId = savedChoice.id;
        AppAlert.alert(t('success'), copy.updated);
      } else {
        const savedChoice = await choiceServiceRef.current!.createChoice(userId, {
          ...choiceData,
          storyId: selectedStory.id,
        });
        savedChoiceId = savedChoice.id;
        setCurrentChoiceId(savedChoice.id);
        AppAlert.alert(t('success'), copy.created);
      }

      if (savedChoiceId) {
        await persistTagRelations(savedChoiceId);
        await persistNoteRelations(savedChoiceId);
        await seeAlsoManagerRef.current?.persistPending(savedChoiceId);
      }
      entityEventEmitter.emit('choice_changed', selectedStory.id, savedChoiceId);

      if (!isEditing && savedChoiceId) {
        navigation.dispatch(StackActions.replace('ChoiceForm', { choiceId: savedChoiceId }));
      } else {
        navigation.goBack();
      }
    } catch (err) {
      console.error('Failed to save choice:', err);
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
    if (!currentChoiceId || !choiceServiceRef.current) {
      return;
    }

    confirmDelete({
      titleKey: 'delete_choice_title',
      title: copy.deleteLabel,
      messageKey: 'delete_choice_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_choice',
      failureMessage: copy.failedToDelete,
      onLoadingChange: setLoading,
      onConfirm: async () => {
        await choiceServiceRef.current!.deleteChoice(userId, currentChoiceId);
        entityEventEmitter.emit('choice_changed', selectedStory?.id, currentChoiceId);
        navigation.goBack();
      },
    });
  };

  const handleAddCheckGroup = async () => {
    if (!userId || !selectedStory?.id || !currentChoiceId || !choiceCheckGroupServiceRef.current) {
      return;
    }
    try {
      const newGroup = await choiceCheckGroupServiceRef.current.createChoiceCheckGroup(userId, {
        storyId: selectedStory.id,
        choiceId: currentChoiceId,
        combinator: 'AND',
        // The highest + 1, and not the count: deleting a group from the middle would make the count repeat the
        // number of a group that still exists, and the order of the two would start depending on
        // the date tie-break.
        order: Math.max(0, ...checkGroups.map((group) => group.order + 1)),
      });
      setCheckGroups((prev) => [...prev, newGroup]);
      entityEventEmitter.emit('choice_check_group_changed', selectedStory.id, currentChoiceId);
    } catch (err) {
      console.error('Failed to add check group:', err);
      AppAlert.alert(t('error'), t('failed_to_save_check_group'));
    }
  };

  const handleUpdateCheckGroupCombinator = async (groupId: string, combinator: 'AND' | 'OR') => {
    if (!userId || !choiceCheckGroupServiceRef.current) {
      return;
    }
    try {
      const updatedGroup = await choiceCheckGroupServiceRef.current.updateChoiceCheckGroup(
        userId,
        groupId,
        { combinator },
      );
      setCheckGroups((prev) => prev.map((group) => (group.id === groupId ? updatedGroup : group)));
    } catch (err) {
      console.error('Failed to update check group:', err);
      AppAlert.alert(t('error'), t('failed_to_save_check_group'));
    }
  };

  const handleDeleteCheckGroup = async (groupId: string) => {
    if (!userId || !choiceCheckGroupServiceRef.current || !choiceCheckServiceRef.current) {
      return;
    }
    try {
      const checksInGroup = checks.filter((check) => check.groupId === groupId);
      for (const check of checksInGroup) {
        await choiceCheckServiceRef.current.deleteChoiceCheck(userId, check.id);
      }
      await choiceCheckGroupServiceRef.current.deleteChoiceCheckGroup(userId, groupId);
      setCheckGroups((prev) => prev.filter((group) => group.id !== groupId));
      setChecks((prev) => prev.filter((check) => check.groupId !== groupId));
      entityEventEmitter.emit('choice_check_group_changed', selectedStory?.id, currentChoiceId);
    } catch (err) {
      console.error('Failed to delete check group:', err);
      AppAlert.alert(t('error'), t('failed_to_delete_check_group'));
    }
  };

  const handleAddCheck = async (groupId: string) => {
    if (!userId || !selectedStory?.id || !choiceCheckServiceRef.current) {
      return;
    }
    try {
      const checksInGroup = checks.filter((check) => check.groupId === groupId);
      const newCheck = await choiceCheckServiceRef.current.createChoiceCheck(userId, {
        storyId: selectedStory.id,
        groupId,
        mode: 'block',
        type: 'sceneCount',
        order: Math.max(0, ...checksInGroup.map((check) => check.order + 1)),
        sceneId: null,
        minVisits: null,
        itemId: null,
        itemPresence: null,
        triggerName: null,
        triggerState: null,
      });
      setChecks((prev) => [...prev, newCheck]);
    } catch (err) {
      console.error('Failed to add check:', err);
      AppAlert.alert(t('error'), t('failed_to_save_check'));
    }
  };

  const handleUpdateCheck = async (
    checkId: string,
    changes: Partial<
      Omit<
        ChoiceCheck,
        | 'id'
        | 'storyId'
        | 'groupId'
        | 'createdAt'
        | 'updatedAt'
        | 'version'
        | 'isDeleted'
        | 'deletedAt'
      >
    >,
  ) => {
    if (!userId || !choiceCheckServiceRef.current) {
      return;
    }
    try {
      const updatedCheck = await choiceCheckServiceRef.current.updateChoiceCheck(
        userId,
        checkId,
        changes,
      );
      setChecks((prev) => prev.map((check) => (check.id === checkId ? updatedCheck : check)));
    } catch (err) {
      console.error('Failed to update check:', err);
      AppAlert.alert(t('error'), t('failed_to_save_check'));
    }
  };

  const handleDeleteCheck = async (checkId: string) => {
    if (!userId || !choiceCheckServiceRef.current) {
      return;
    }
    try {
      await choiceCheckServiceRef.current.deleteChoiceCheck(userId, checkId);
      setChecks((prev) => prev.filter((check) => check.id !== checkId));
    } catch (err) {
      console.error('Failed to delete check:', err);
      AppAlert.alert(t('error'), t('failed_to_delete_check'));
    }
  };

  const handleChangeCheckType = (checkId: string, type: ChoiceCheck['type']) => {
    handleUpdateCheck(checkId, {
      type,
      sceneId: null,
      minVisits: type === 'sceneCount' ? 1 : null,
      itemId: null,
      itemPresence: type === 'inventory' ? 'has' : null,
      triggerName: null,
      triggerState: type === 'trigger' ? 'set' : null,
    });
  };

  const handleAddEffect = async () => {
    if (!userId || !selectedStory?.id || !currentChoiceId || !effectServiceRef.current) {
      return;
    }
    try {
      const newEffect = await effectServiceRef.current.createEffect(userId, {
        storyId: selectedStory.id,
        entityType: 'Choice',
        entityId: currentChoiceId,
        effectType: 'itemGrant',
        itemId: null,
        triggerName: null,
      });
      setChoiceEffects((prev) => [...prev, newEffect]);
      entityEventEmitter.emit('effect_changed', selectedStory.id, currentChoiceId);
    } catch (err) {
      console.error('Failed to add effect:', err);
      AppAlert.alert(t('error'), t('failed_to_save_effect'));
    }
  };

  const handleUpdateEffect = async (
    effectId: string,
    changes: Partial<
      Omit<
        Effect,
        | 'id'
        | 'storyId'
        | 'entityType'
        | 'entityId'
        | 'createdAt'
        | 'updatedAt'
        | 'version'
        | 'isDeleted'
        | 'deletedAt'
      >
    >,
  ) => {
    if (!userId || !effectServiceRef.current) {
      return;
    }
    try {
      const updatedEffect = await effectServiceRef.current.updateEffect(userId, effectId, changes);
      setChoiceEffects((prev) =>
        prev.map((effect) => (effect.id === effectId ? updatedEffect : effect)),
      );
      entityEventEmitter.emit('effect_changed', selectedStory?.id, currentChoiceId);
    } catch (err) {
      console.error('Failed to update effect:', err);
      AppAlert.alert(t('error'), t('failed_to_save_effect'));
    }
  };

  const handleChangeEffectType = (effectId: string, effectType: Effect['effectType']) => {
    handleUpdateEffect(effectId, {
      effectType,
      itemId: null,
      triggerName: null,
    });
  };

  const handleDeleteEffect = async (effectId: string) => {
    if (!userId || !effectServiceRef.current) {
      return;
    }
    try {
      await effectServiceRef.current.deleteEffect(userId, effectId);
      setChoiceEffects((prev) => prev.filter((effect) => effect.id !== effectId));
      entityEventEmitter.emit('effect_changed', selectedStory?.id, currentChoiceId);
    } catch (err) {
      console.error('Failed to delete effect:', err);
      AppAlert.alert(t('error'), t('failed_to_delete_effect'));
    }
  };

  const sceneOptions = useMemo(
    () => scenes.map((scene) => ({ label: scene.name, value: scene.id })),
    [scenes],
  );
  const itemOptions = useMemo(
    () =>
      items.filter((item) => !item.isDeleted).map((item) => ({ label: item.name, value: item.id })),
    [items],
  );

  const checkTypeOptions = useMemo(
    () => [
      { label: t('check_type_scene_count'), value: 'sceneCount' },
      { label: t('check_type_inventory'), value: 'inventory' },
      { label: t('check_type_trigger'), value: 'trigger' },
    ],
    [t],
  );

  const checkModeOptions = useMemo(
    () => [
      { label: t('check_mode_block'), value: 'block' },
      { label: t('check_mode_enable'), value: 'enable' },
    ],
    [t],
  );

  const combinatorOptions = useMemo(
    () => [
      { label: t('combinator_and'), value: 'AND' },
      { label: t('combinator_or'), value: 'OR' },
    ],
    [t],
  );

  const itemPresenceOptions = useMemo(
    () => [
      { label: t('item_presence_has'), value: 'has' },
      { label: t('item_presence_lacks'), value: 'lacks' },
    ],
    [t],
  );

  const triggerStateOptions = useMemo(
    () => [
      { label: t('trigger_state_set'), value: 'set' },
      { label: t('trigger_state_unset'), value: 'unset' },
    ],
    [t],
  );

  const effectTypeOptions = useMemo(
    () => [
      { label: t('effect_type_item_grant'), value: 'itemGrant' },
      { label: t('effect_type_item_take'), value: 'itemTake' },
      { label: t('effect_type_trigger_set'), value: 'triggerSet' },
      { label: t('effect_type_trigger_unset'), value: 'triggerUnset' },
    ],
    [t],
  );

  const styles = StyleSheet.create({
    ...commonFormStyleDefs(colors, scrollBottomPadding),
    noteSection: { marginTop: 20, marginBottom: -10 },
    tagSection: { marginTop: 20, marginBottom: 0 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 10 },
    sectionDescription: { color: colors.textSecondary, marginBottom: 10 },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      backgroundColor: colors.surface,
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    cardRowLabel: { color: colors.textSecondary, fontSize: 13, marginBottom: 4 },
    fieldFlex: { flex: 1 },
    checkCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      padding: 10,
      marginTop: 8,
      backgroundColor: colors.background,
    },
    effectsSection: {
      marginTop: 30,
      marginBottom: 20,
    },
    removeLink: { color: colors.error, fontWeight: '600' },
    addLink: { color: colors.primary, fontWeight: '600', marginTop: 4 },
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

      <Text style={[styles.label, { color: colors.text }]}>{t('text')}</Text>
      <TextInput
        placeholder={t('text_placeholder')}
        value={text}
        onChangeText={setText}
        style={commonInputStyles.multiline}
        multiline
      />

      <Text style={[styles.label, { color: colors.text }]}>
        {t('vocabulary_parent_entity', { entity: sceneCopy.entity })}
      </Text>
      <SingleSelectPill
        options={sceneOptions}
        value={sceneId}
        onValueChange={setSceneId}
        placeholder={sceneCopy.select}
        multiple={false}
      />

      <Text style={[styles.label, { color: colors.text }]}>
        {t('vocabulary_next_entity', { entity: sceneCopy.entity })}
      </Text>
      <SingleSelectPill
        options={sceneOptions}
        value={nextSceneId}
        onValueChange={setNextSceneId}
        placeholder={sceneCopy.select}
        multiple={false}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('choice_notes')}</Text>
      <TextInput
        placeholder={t('choice_notes_placeholder')}
        value={notes || ''}
        onChangeText={setNotes}
        style={commonInputStyles.multiline}
        multiline
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
            onSelectionChange={setSelectedTagIds}
            placeholder={t('select_tags_for_choice')}
            label={t('choice_tags')}
          />
        </View>
      )}

      {currentChoiceId && selectedStory?.id && isBranching && (
        <View style={styles.tagSection}>
          <Text style={styles.sectionTitle}>{t('checks_title')}</Text>
          <Text style={styles.sectionDescription}>{t('checks_groups_and_note')}</Text>

          {checkGroups.map((group) => {
            const groupChecks = checks.filter((check) => check.groupId === group.id);
            return (
              <View key={group.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.fieldFlex}>
                    <Text style={styles.cardRowLabel}>{t('check_group_combinator')}</Text>
                    <SingleSelectPill
                      options={combinatorOptions}
                      value={group.combinator}
                      onValueChange={(value) =>
                        value && handleUpdateCheckGroupCombinator(group.id, value as 'AND' | 'OR')
                      }
                      multiple={false}
                    />
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteCheckGroup(group.id)}>
                    <Text style={styles.removeLink}>{t('remove_check_group')}</Text>
                  </TouchableOpacity>
                </View>

                {groupChecks.length === 0 && (
                  <Text style={{ color: colors.textSecondary }}>{t('no_checks_in_group')}</Text>
                )}

                {groupChecks.map((check) => (
                  <View key={check.id} style={styles.checkCard}>
                    <View style={styles.cardRow}>
                      <View style={styles.fieldFlex}>
                        <Text style={styles.cardRowLabel}>{t('check_type')}</Text>
                        <SingleSelectPill
                          options={checkTypeOptions}
                          value={check.type}
                          onValueChange={(value) =>
                            value && handleChangeCheckType(check.id, value as ChoiceCheck['type'])
                          }
                          multiple={false}
                        />
                      </View>
                      <View style={styles.fieldFlex}>
                        <Text style={styles.cardRowLabel}>{t('check_mode')}</Text>
                        <SingleSelectPill
                          options={checkModeOptions}
                          value={check.mode}
                          onValueChange={(value) =>
                            value &&
                            handleUpdateCheck(check.id, { mode: value as 'block' | 'enable' })
                          }
                          multiple={false}
                        />
                      </View>
                    </View>

                    {check.type === 'sceneCount' && (
                      <View style={styles.cardRow}>
                        <View style={styles.fieldFlex}>
                          <Text style={styles.cardRowLabel}>{t('check_scene')}</Text>
                          <SingleSelectPill
                            options={sceneOptions}
                            value={check.sceneId}
                            onValueChange={(value) =>
                              handleUpdateCheck(check.id, { sceneId: value })
                            }
                            placeholder={sceneCopy.select}
                            multiple={false}
                            allowDeselect={true}
                          />
                        </View>
                        <View style={styles.fieldFlex}>
                          <Text style={styles.cardRowLabel}>{t('check_min_visits')}</Text>
                          <TextInput
                            placeholder={t('check_min_visits_placeholder')}
                            value={check.minVisits !== null ? String(check.minVisits) : ''}
                            onChangeText={(value) =>
                              handleUpdateCheck(check.id, {
                                minVisits: value ? Number(value) : null,
                              })
                            }
                            keyboardType="numeric"
                            style={commonInputStyles.input}
                          />
                        </View>
                      </View>
                    )}

                    {check.type === 'inventory' && (
                      <View style={styles.cardRow}>
                        <View style={styles.fieldFlex}>
                          <Text style={styles.cardRowLabel}>{t('check_item')}</Text>
                          <SingleSelectPill
                            options={itemOptions}
                            value={check.itemId}
                            onValueChange={(value) =>
                              handleUpdateCheck(check.id, { itemId: value })
                            }
                            placeholder={t('select_item')}
                            multiple={false}
                            allowDeselect={true}
                          />
                        </View>
                        <View style={styles.fieldFlex}>
                          <Text style={styles.cardRowLabel}>{t('check_item_presence')}</Text>
                          <SingleSelectPill
                            options={itemPresenceOptions}
                            value={check.itemPresence}
                            onValueChange={(value) =>
                              value &&
                              handleUpdateCheck(check.id, {
                                itemPresence: value as 'has' | 'lacks',
                              })
                            }
                            multiple={false}
                          />
                        </View>
                      </View>
                    )}

                    {check.type === 'trigger' && (
                      <View style={styles.cardRow}>
                        <View style={styles.fieldFlex}>
                          <Text style={styles.cardRowLabel}>{t('check_trigger_name')}</Text>
                          <TextInput
                            placeholder={t('check_trigger_name_placeholder')}
                            value={check.triggerName || ''}
                            onChangeText={(value) =>
                              handleUpdateCheck(check.id, { triggerName: value || null })
                            }
                            style={commonInputStyles.input}
                          />
                        </View>
                        <View style={styles.fieldFlex}>
                          <Text style={styles.cardRowLabel}>{t('check_trigger_state')}</Text>
                          <SingleSelectPill
                            options={triggerStateOptions}
                            value={check.triggerState}
                            onValueChange={(value) =>
                              value &&
                              handleUpdateCheck(check.id, {
                                triggerState: value as 'set' | 'unset',
                              })
                            }
                            multiple={false}
                          />
                        </View>
                      </View>
                    )}

                    <TouchableOpacity onPress={() => handleDeleteCheck(check.id)}>
                      <Text style={styles.removeLink}>{t('remove_check')}</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity onPress={() => handleAddCheck(group.id)}>
                  <Text style={styles.addLink}>{t('add_check')}</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {checkGroups.length === 0 && (
            <Text style={{ color: colors.textSecondary, marginBottom: 10 }}>
              {t('no_check_groups')}
            </Text>
          )}

          <TouchableOpacity onPress={handleAddCheckGroup}>
            <Text style={styles.addLink}>{t('add_check_group')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {currentChoiceId && selectedStory?.id && isBranching && (
        <View style={[styles.tagSection, styles.effectsSection]}>
          <Text style={styles.sectionTitle}>{t('effects_title')}</Text>

          {choiceEffects.map((effect) => (
            <View key={effect.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.fieldFlex}>
                  <Text style={styles.cardRowLabel}>{t('effect_type')}</Text>
                  <SingleSelectPill
                    options={effectTypeOptions}
                    value={effect.effectType}
                    onValueChange={(value) =>
                      value && handleChangeEffectType(effect.id, value as Effect['effectType'])
                    }
                    multiple={false}
                  />
                </View>
              </View>

              {(effect.effectType === 'itemGrant' || effect.effectType === 'itemTake') && (
                <View style={styles.cardRow}>
                  <View style={styles.fieldFlex}>
                    <Text style={styles.cardRowLabel}>{t('check_item')}</Text>
                    <SingleSelectPill
                      options={itemOptions}
                      value={effect.itemId}
                      onValueChange={(value) => handleUpdateEffect(effect.id, { itemId: value })}
                      placeholder={t('select_item')}
                      multiple={false}
                      allowDeselect={true}
                    />
                  </View>
                </View>
              )}

              {(effect.effectType === 'triggerSet' || effect.effectType === 'triggerUnset') && (
                <View style={styles.cardRow}>
                  <View style={styles.fieldFlex}>
                    <Text style={styles.cardRowLabel}>{t('check_trigger_name')}</Text>
                    <TextInput
                      placeholder={t('check_trigger_name_placeholder')}
                      value={effect.triggerName || ''}
                      onChangeText={(value) =>
                        handleUpdateEffect(effect.id, { triggerName: value || null })
                      }
                      style={commonInputStyles.input}
                    />
                  </View>
                </View>
              )}

              <TouchableOpacity onPress={() => handleDeleteEffect(effect.id)}>
                <Text style={styles.removeLink}>{t('remove_effect')}</Text>
              </TouchableOpacity>
            </View>
          ))}

          {choiceEffects.length === 0 && (
            <Text style={{ color: colors.textSecondary, marginBottom: 10 }}>{t('no_effects')}</Text>
          )}

          <TouchableOpacity onPress={handleAddEffect}>
            <Text style={styles.addLink}>{t('add_effect')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <NoteManager
            noteRelations={choiceNoteRelations}
            availableNotes={allNotes}
            onSave={saveNoteRelation}
            onDelete={deleteNoteRelation}
            editable={true}
            currentStoryId={selectedStory.id}
            currentEntityId={currentChoiceId ?? ''}
            currentEntityType="Choice"
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <SeeAlsoManager
            ref={seeAlsoManagerRef}
            storyId={selectedStory.id}
            entityType="Choice"
            entityId={currentChoiceId ?? ''}
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

export default ChoiceFormScreen;
