import MultiSelectPill from '@/src/components/common/MultiSelectPill/MultiSelectPill';
import { WorldRule } from '@keres/shared/entities/WorldRule';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RouteProp, StackActions, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'; // Import StackActions
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableWithoutFeedback, View } from 'react-native';
import Button from '../../components/common/Button/Button';
import TextInput from '../../components/common/TextInput/TextInput';
import NoteManager from '../../components/NoteManager'; // Import NoteManager
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { MainSystemDrawerParamList, WorldRulesStackParamList } from '../../navigation/MainSystemStack';
import { createWorldRuleService } from '../../services/storymanagement/WorldRuleService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter';

type WorldRuleFormScreenRouteProp = RouteProp<WorldRulesStackParamList, 'WorldRuleForm'>;

const WorldRuleFormScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const drawerNavigation = useNavigation<DrawerNavigationProp<MainSystemDrawerParamList>>();
  const route = useRoute<WorldRuleFormScreenRouteProp>();
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore()
  const { worldRuleId: initialWorldRuleId } = route.params || {}; // Renamed to initialWorldRuleId
  const { selectedStory } = useStoryStore();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();
  const confirmDelete = useConfirmDelete();
  const worldRuleServiceRef = useRef<ReturnType<typeof createWorldRuleService> | null>(null);

  useEffect(() => {
    if (drizzleDb && !worldRuleServiceRef.current) {
      worldRuleServiceRef.current = createWorldRuleService(drizzleDb);
    }
  }, [drizzleDb]);

  const [currentWorldRuleId, setCurrentWorldRuleId] = useState<string | undefined>(initialWorldRuleId); // State to manage worldRuleId
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState<string | null>(null);
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
  } = useEntityRelations({ entityType: 'WorldRule', entityId: currentWorldRuleId });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!currentWorldRuleId;

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: isEditing ? t('edit_world_rule_title') : t('create_world_rule_title'),
        headerRight: () => {<View/>}
      });
    }, [navigation, isEditing, t])
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
            setIsFavorite(fetchedWorldRule.isFavorite);
            setExtraNotes(fetchedWorldRule.extraNotes);
          } else {
            setError(t('world_rule_not_found'));
          }
        }
      } catch (err) {
        console.error('Failed to load world rule:', err);
        setError(t('failed_to_load_world_rule'));
      } finally {
        setLoading(false);
      }
    };
    loadWorldRule();
  }, [currentWorldRuleId, isEditing, selectedStory?.id, t]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert(t('error'), t('world_rule_title_required'));
      return;
    }
    if (!userId) {
      Alert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!selectedStory?.id) {
      Alert.alert(t('error'), t('no_story_selected'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const worldRuleData: Omit<WorldRule, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'> = {
        title: title.trim(),
        description: description,
        isFavorite: isFavorite,
        extraNotes: extraNotes,
      };
      let savedWorldRule: WorldRule;

      if (isEditing) {
        savedWorldRule = await worldRuleServiceRef.current!.updateWorldRule(userId, currentWorldRuleId!, worldRuleData);
        Alert.alert(t('success'), t('world_rule_updated_successfully'));
      } else {
        savedWorldRule = await worldRuleServiceRef.current!.createWorldRule(userId, { ...worldRuleData, storyId: selectedStory.id });
        Alert.alert(t('success'), t('world_rule_created_successfully'));
        setCurrentWorldRuleId(savedWorldRule.id);
      }

      if (savedWorldRule.id) {
        await persistTagRelations(savedWorldRule.id);
      }


      entityEventEmitter.emit('worldrule_changed', selectedStory.id, savedWorldRule.id);

      if (!isEditing && savedWorldRule.id) {
        navigation.dispatch(StackActions.replace('WorldRuleForm', { worldRuleId: savedWorldRule.id }));
      } else {
        navigation.goBack();
      }

    } catch (err) {
      console.error('Failed to save world rule:', err);
      setError(t('failed_to_save_world_rule'));
      Alert.alert(t('error'), t('failed_to_save_world_rule'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!userId) {
      Alert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!currentWorldRuleId || !worldRuleServiceRef.current) {
      return;
    }

    confirmDelete({
      titleKey: 'delete_world_rule_title',
      messageKey: 'delete_world_rule_message',
      successKey: 'world_rule_deleted_successfully',
      failureKey: 'failed_to_delete_world_rule',
      onLoadingChange: setLoading,
      onConfirm: async () => {
        await worldRuleServiceRef.current!.deleteWorldRule(userId, currentWorldRuleId);
        entityEventEmitter.emit('worldrule_changed', selectedStory?.id, currentWorldRuleId);
        navigation.goBack();
      },
    });
  };

  const handleTagSelectionChange = useCallback((newSelection: string[]) => {
    setSelectedTagIds(newSelection);
  }, [setSelectedTagIds]);

  const styles = StyleSheet.create({
    scrollViewContent: {
      padding: 20,
      paddingBottom: 350,
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
      marginTop: 20,
      marginBottom: 0,
    },
    deleteButton: {
      backgroundColor: 'red',
      marginBottom: 15
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tagSection: {
      marginTop: 20,
      marginBottom: 10,
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
          <Text style={[styles.title, { color: colors.text }]}>{isEditing ? t('edit_world_rule_title') : t('create_world_rule_title')}</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
            {t('world_rule_form_description')}
          </Text>

          <Text style={[styles.label, { color: colors.text }]}>{t('title')}</Text>
          <TextInput
            placeholder={t('world_rule_title_placeholder')}
            value={title}
            onChangeText={setTitle}
            style={commonInputStyles.input}
          />

          <View style={styles.switchContainer}>
            <Text style={[styles.label, { color: colors.text, flex: 1, lineHeight: 30, marginTop: 5 }]}>{t('is_favorite')}</Text>
            <Switch
              value={isFavorite}
              onValueChange={setIsFavorite}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={isFavorite ? colors.onPrimary : colors.textSecondary}
              style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
            />
          </View>

          <Text style={[styles.label, { color: colors.text }]}>{t('description')}</Text>
          <TextInput
            placeholder={t('world_rule_description_placeholder')}
            value={description || ""}
            onChangeText={setDescription}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
          />
          
          <Text style={[styles.label, { color: colors.text }]}>{t('extra_notes')}</Text>
          <TextInput
            placeholder={t('world_rule_extra_notes_placeholder')}
            value={extraNotes || ""}
            onChangeText={setExtraNotes}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
          />

          <View style={styles.tagSection}>
            <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
            <MultiSelectPill
              options={availableTags.map(tag => ({ label: tag.name, value: tag.id, color: tag.color || colors.primaryContainer }))}
              selectedValues={selectedTagIds}
              onSelectionChange={handleTagSelectionChange}
              placeholder={t('select_tags_for_world_rule')}
              label={t('world_rule_tags')}
            />
          </View>

          {currentWorldRuleId && selectedStory?.id && (
            <View style={styles.tagSection}>
              <Text style={styles.sectionTitle}>{t('notes_title')}</Text>
              <NoteManager
                noteRelations={worldRuleNoteRelations}
                availableNotes={allNotes}
                onSave={saveNoteRelation}
                onDelete={deleteNoteRelation}
                editable={true}
                currentStoryId={selectedStory.id}
                currentEntityId={currentWorldRuleId}
                currentEntityType="WorldRule"
              />
            </View>
          )}

          <Button onPress={handleSave} style={styles.saveButton}>
            {isEditing ? t('save_changes') : t('create_world_rule')}
          </Button>

          {isEditing && (
            <Button onPress={handleDelete} style={[styles.saveButton, styles.deleteButton]}>
              {t('delete_world_rule_title')}
            </Button>
          )}

          <View style={{ height: 90 }} />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default WorldRuleFormScreen;